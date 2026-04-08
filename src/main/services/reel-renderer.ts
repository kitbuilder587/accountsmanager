import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { DetectedRegion } from '../../shared/reel.js';
import { getReelById, getReelDirectory } from './reel-repository.js';
import { getAppPaths } from './app-paths.js';

const execFileAsync = promisify(execFile);

interface RenderResult {
  videoPath: string;
}

interface VideoInfo {
  width: number;
  height: number;
}

const WATERMARK_LOGO_PATH = path.resolve('watermarks/watermark-logo.png');
const WATERMARK_BANNER_PATH = path.resolve('watermarks/watermark-banner.png');

async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'json',
    videoPath,
  ], { timeout: 15_000 });

  const data = JSON.parse(stdout);
  const stream = data.streams?.[0];
  return {
    width: stream?.width || 720,
    height: stream?.height || 1280,
  };
}

/**
 * Creates a full-frame transparent PNG overlay with:
 * 1. Black rects over "mask" regions (hide foreign brands)
 * 2. Black rect + new text over "replace" region (replace main text)
 * 3. Watermarks at bottom
 */
async function createFullFrameOverlay(
  finalText: string | null,
  videoWidth: number,
  videoHeight: number,
  regions: DetectedRegion[],
): Promise<string> {
  const tmpDir = path.join(getAppPaths().reelsDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `overlay-${Date.now()}.png`);

  const canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext('2d');

  // 1. Mask regions: draw opaque black rects
  const maskRegions = regions.filter(r => r.action === 'mask' && r.w > 0);
  for (const region of maskRegions) {
    const pad = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(region.x - pad, region.y - pad, region.w + pad * 2, region.h + pad * 2);
  }

  // 2. Replace region: mask original + draw new text
  const replaceRegions = regions.filter(r => r.action === 'replace' && r.w > 0);

  if (replaceRegions.length > 0) {
    // Calculate combined bbox of all replace regions
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    for (const r of replaceRegions) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }

    const pad = 8;
    const regionX = Math.max(0, minX - pad);
    const regionY = Math.max(0, minY - pad);
    const regionW = maxX - minX + pad * 2;
    const regionH = maxY - minY + pad * 2;

    // Mask original text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(regionX, regionY, regionW, regionH);

    // Draw new text in the replace region
    if (finalText) {
      const fontSize = Math.max(16, Math.min(48, Math.round(regionH * 0.4)));
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxWidth = regionW - 20;
      const words = finalText.split(/\s+/);
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);

      const lineHeight = fontSize * 1.3;
      const totalHeight = lines.length * lineHeight;
      const startY = regionY + (regionH - totalHeight) / 2 + fontSize * 0.65;
      const centerX = regionX + regionW / 2;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], centerX, startY + i * lineHeight);
      }
    }
  } else if (finalText) {
    // No replace region — place text above watermarks
    const fontSize = Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));
    const barW = videoWidth;
    const barH = Math.round(fontSize * 1.3 + 48);
    const barX = 0;
    const barY = videoHeight - barH - 480;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = barW - 40;
    const words = finalText.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = barY + (barH - totalHeight) / 2 + fontSize * 0.65;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], barW / 2, startY + i * lineHeight);
    }
  }

  // 3. Draw watermarks at bottom
  let wmBottomY = videoHeight;

  if (fs.existsSync(WATERMARK_LOGO_PATH)) {
    try {
      const logoImg = await loadImage(WATERMARK_LOGO_PATH);
      const logoW = Math.round(videoWidth * 0.8);
      const logoH = Math.round((logoImg.height / logoImg.width) * logoW);
      const logoX = Math.round((videoWidth - logoW) / 2);
      const logoY = videoHeight - logoH - 10;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      wmBottomY = logoY;
    } catch (err) {
      console.warn('[Renderer] Could not load logo watermark:', err);
    }
  }

  if (fs.existsSync(WATERMARK_BANNER_PATH)) {
    try {
      const bannerImg = await loadImage(WATERMARK_BANNER_PATH);
      const bannerW = Math.round(videoWidth * 0.85);
      const bannerH = Math.round((bannerImg.height / bannerImg.width) * bannerW);
      const bannerX = Math.round((videoWidth - bannerW) / 2);
      const bannerY = wmBottomY - bannerH - 5;
      ctx.drawImage(bannerImg, bannerX, bannerY, bannerW, bannerH);
    } catch (err) {
      console.warn('[Renderer] Could not load banner watermark:', err);
    }
  }

  fs.writeFileSync(pngPath, Buffer.from(canvas.toBuffer('image/png')));
  return pngPath;
}

export async function renderReel(reelId: string): Promise<RenderResult> {
  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);
  if (!reel.originalVideo) throw new Error('No original video to render');

  const reelDir = getReelDirectory(reelId);
  const outputPath = path.join(reelDir, 'processed.mp4');

  const videoInfo = await getVideoInfo(reel.originalVideo);
  const rawRegions = reel.detectedRegions;
  const regions: DetectedRegion[] = Array.isArray(rawRegions)
    ? rawRegions
    : (typeof rawRegions === 'string' ? (() => { try { return JSON.parse(rawRegions); } catch { return []; } })() : []);

  const overlayPath = await createFullFrameOverlay(
    reel.finalText,
    videoInfo.width,
    videoInfo.height,
    regions,
  );

  const ffmpegArgs: string[] = [
    '-i', reel.originalVideo,
    '-loop', '1', '-i', overlayPath,
    '-filter_complex', '[0:v][1:v]overlay=0:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-map', '0:a?',
    '-c:a', 'copy',
    '-shortest',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  console.log(`[Renderer] ffmpeg ${ffmpegArgs.join(' ')}`);

  try {
    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 300_000 });
  } finally {
    try { fs.unlinkSync(overlayPath); } catch { /* ignore */ }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg did not produce output file');
  }

  return { videoPath: outputPath };
}
