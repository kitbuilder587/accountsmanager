import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

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

function escapePangoMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
 * Generate a transparent PNG with text using sharp + SVG.
 * Works on any platform without system font dependencies.
 */
async function createTextOverlay(
  text: string,
  videoWidth: number,
  videoHeight: number,
  options: {
    position: 'center-bottom' | 'region';
    regionX?: number;
    regionY?: number;
    regionW?: number;
    regionH?: number;
  },
): Promise<{ pngPath: string; overlayWidth: number; overlayHeight: number }> {
  const tmpDir = path.join(getAppPaths().reelsDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `text-${Date.now()}.png`);

  const escaped = escapePangoMarkup(text);

  if (options.position === 'region' && options.regionW && options.regionH) {
    const w = options.regionW;
    const h = options.regionH;
    const fontSize = Math.max(14, Math.min(42, Math.round(h * 0.5)));

    // Render text with sharp's built-in Pango text support
    const textImg = await sharp({
      text: {
        text: `<span foreground="white" font_desc="Sans Bold ${fontSize}">${escaped}</span>`,
        rgba: true,
        width: w - 20,
        align: 'centre',
      },
    }).png().toBuffer();

    // Create dark background and composite text on top
    await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 217 } },
    })
      .composite([{ input: textImg, gravity: 'centre' }])
      .png()
      .toFile(pngPath);

    return { pngPath, overlayWidth: w, overlayHeight: h };
  }

  // Center-bottom: full-width text bar
  const fontSize = Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));
  const barWidth = videoWidth;
  const textWidth = barWidth - 60;

  // Render text first to measure its height
  const textImg = await sharp({
    text: {
      text: `<span foreground="white" font_desc="Sans Bold ${fontSize}">${escaped}</span>`,
      rgba: true,
      width: textWidth,
      align: 'centre',
    },
  }).png().toBuffer();

  const textMeta = await sharp(textImg).metadata();
  const textHeight = textMeta.height || fontSize + 10;
  const padding = 24;
  const finalBarHeight = textHeight + padding * 2;

  // Create dark semi-transparent background and composite text
  await sharp({
    create: { width: barWidth, height: finalBarHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 178 } },
  })
    .composite([{ input: textImg, gravity: 'centre' }])
    .png()
    .toFile(pngPath);

  return { pngPath, overlayWidth: barWidth, overlayHeight: finalBarHeight };
}

export async function renderReel(reelId: string): Promise<RenderResult> {
  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);
  if (!reel.originalVideo) throw new Error('No original video to render');

  const reelDir = getReelDirectory(reelId);
  const outputPath = path.join(reelDir, 'processed.mp4');
  const brandingPath = path.join(getAppPaths().assetsDir, 'branding-plate.png');

  const videoInfo = await getVideoInfo(reel.originalVideo);
  const overlayInputs: string[] = [];
  const filterParts: string[] = [];
  let inputIndex = 1; // 0 is the video

  const ffmpegArgs: string[] = ['-i', reel.originalVideo];

  // Text overlay
  if (reel.finalText) {
    const hasRegion = reel.textRegionX !== null && reel.textRegionY !== null &&
      reel.textRegionW !== null && reel.textRegionH !== null;

    const overlay = await createTextOverlay(
      reel.finalText,
      videoInfo.width,
      videoInfo.height,
      hasRegion
        ? {
            position: 'region',
            regionX: reel.textRegionX!,
            regionY: reel.textRegionY!,
            regionW: reel.textRegionW!,
            regionH: reel.textRegionH!,
          }
        : { position: 'center-bottom' },
    );

    ffmpegArgs.push('-i', overlay.pngPath);
    overlayInputs.push(overlay.pngPath);

    if (hasRegion) {
      // Overlay text PNG at exact OCR region position
      filterParts.push(`[${inputIndex}:v]scale=${reel.textRegionW}:${reel.textRegionH}[txt${inputIndex}]`);
      filterParts.push(`[base][txt${inputIndex}]overlay=${reel.textRegionX}:${reel.textRegionY}[base]`);
    } else {
      // Overlay text bar at bottom center
      const yPos = videoInfo.height - overlay.overlayHeight - 40;
      filterParts.push(`[base][${inputIndex}:v]overlay=0:${yPos}[base]`);
    }
    inputIndex++;
  }

  // Branding overlay
  if (fs.existsSync(brandingPath)) {
    ffmpegArgs.push('-i', brandingPath);
    const brandScale = Math.round(videoInfo.width * 0.15);
    filterParts.push(`[${inputIndex}:v]scale=${brandScale}:-1[brand]`);
    filterParts.push(`[base][brand]overlay=W-w-20:H-h-20[base]`);
    inputIndex++;
  }

  // Build filter_complex
  if (filterParts.length > 0) {
    // Initialize [base] from input video
    const initFilter = `[0:v]copy[base]`;
    // Last filter should output without label
    const allFilters = [initFilter, ...filterParts];
    // Remove [base] label from the last output
    const lastIdx = allFilters.length - 1;
    allFilters[lastIdx] = allFilters[lastIdx].replace(/\[base\]$/, '');

    ffmpegArgs.push('-filter_complex', allFilters.join(';'));
    ffmpegArgs.push('-map', '0:a?');
  }

  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  );

  try {
    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 300_000 });
  } finally {
    // Clean up temp overlay PNGs
    for (const f of overlayInputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg did not produce output file');
  }

  return { videoPath: outputPath };
}
