import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
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

const WATERMARK_LOGO_PATH = path.resolve('watermarks/Screenshot 2026-03-30 at 11.34.20.png');
const WATERMARK_BANNER_PATH = path.resolve('watermarks/Screenshot 2026-03-30 at 11.32.21.png');

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
 * 1. Black rect over original text region (masking)
 * 2. New text on dark bar
 * 3. CheapGPT.ru watermark in bottom-right
 */
async function createFullFrameOverlay(
  text: string | null,
  videoWidth: number,
  videoHeight: number,
  region: { x: number; y: number; w: number; h: number } | null,
): Promise<string> {
  const tmpDir = path.join(getAppPaths().reelsDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `overlay-${Date.now()}.png`);

  const canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext('2d');

  // 1. Mask original text: draw opaque black rect over OCR region
  if (region) {
    const pad = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(
      region.x - pad,
      region.y - pad,
      region.w + pad * 2,
      region.h + pad * 2,
    );
  }

  // 2. Draw new text bar
  if (text) {
    const fontSize = region
      ? Math.max(14, Math.min(42, Math.round(region.h * 0.5)))
      : Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));

    const barW = region ? region.w + 10 : videoWidth;
    const barH = region ? region.h + 10 : Math.round(fontSize * 1.3 + 48);
    const barX = region ? region.x - 5 : 0;
    // When no OCR region, place text above watermarks area (~350px from bottom)
    const barY = region ? region.y - 5 : videoHeight - barH - 350;

    // Dark bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    // White text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word-wrap
    const maxWidth = barW - 40;
    const words = text.split(/\s+/);
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
    const centerX = barX + barW / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], centerX, startY + i * lineHeight);
    }
  }

  // 3. Draw watermarks at bottom (logo + banner stacked)
  let wmBottomY = videoHeight; // tracks where the next watermark goes (from bottom up)

  // CheapGPT.ru logo — at very bottom, centered
  if (fs.existsSync(WATERMARK_LOGO_PATH)) {
    try {
      const logoImg = await loadImage(WATERMARK_LOGO_PATH);
      const logoW = Math.round(videoWidth * 0.45);
      const logoH = Math.round((logoImg.height / logoImg.width) * logoW);
      const logoX = Math.round((videoWidth - logoW) / 2);
      const logoY = videoHeight - logoH - 10;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      wmBottomY = logoY;
    } catch (err) {
      console.warn('[Renderer] Could not load logo watermark:', err);
    }
  }

  // Banner "OpenAI API в 3 раза дешевле" — above logo
  if (fs.existsSync(WATERMARK_BANNER_PATH)) {
    try {
      const bannerImg = await loadImage(WATERMARK_BANNER_PATH);
      const bannerW = Math.round(videoWidth * 0.7);
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

  const hasRegion = reel.textRegionX !== null && reel.textRegionY !== null &&
    reel.textRegionW !== null && reel.textRegionH !== null;

  const overlayPath = await createFullFrameOverlay(
    reel.finalText,
    videoInfo.width,
    videoInfo.height,
    hasRegion
      ? { x: reel.textRegionX!, y: reel.textRegionY!, w: reel.textRegionW!, h: reel.textRegionH! }
      : null,
  );

  const ffmpegArgs: string[] = [
    '-i', reel.originalVideo,
    '-loop', '1', '-i', overlayPath,
    '-filter_complex', '[0:v][1:v]overlay=0:0:shortest=1',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  console.log(`[Renderer] ffmpeg ${ffmpegArgs.join(' ')}`);
  console.log(`[Renderer] Overlay: ${overlayPath} (${fs.statSync(overlayPath).size} bytes)`);

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
