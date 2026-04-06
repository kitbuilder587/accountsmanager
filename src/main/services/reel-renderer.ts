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
/**
 * Creates a full-frame transparent PNG overlay with text composited at the right position.
 * Using a full-frame overlay with overlay=0:0 is the most reliable approach across all ffmpeg builds.
 */
async function createFullFrameOverlay(
  text: string,
  videoWidth: number,
  videoHeight: number,
  region: { x: number; y: number; w: number; h: number } | null,
): Promise<string> {
  const tmpDir = path.join(getAppPaths().reelsDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `text-${Date.now()}.png`);

  const escaped = escapePangoMarkup(text);
  const fontSize = region
    ? Math.max(14, Math.min(42, Math.round(region.h * 0.5)))
    : Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));
  const textWidth = region ? region.w - 20 : videoWidth - 60;

  // Render text using sharp's Pango engine
  const textBuf = await sharp({
    text: {
      text: `<span foreground="white" font_desc="Sans Bold ${fontSize}">${escaped}</span>`,
      rgba: true,
      width: textWidth,
      align: 'centre',
    },
  }).png().toBuffer();

  const textMeta = await sharp(textBuf).metadata();
  const textH = textMeta.height || fontSize + 10;

  // Create the bar (dark background + text)
  const barW = region ? region.w : videoWidth;
  const barH = region ? region.h : textH + 48;

  const bar = await sharp({
    create: { width: barW, height: barH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 180 } },
  })
    .composite([{ input: textBuf, gravity: 'centre' }])
    .png()
    .toBuffer();

  // Create full-frame transparent image and place the bar
  const barX = region ? region.x : 0;
  const barY = region ? region.y : videoHeight - barH - 40;

  const fullFrame = await sharp({
    create: { width: videoWidth, height: videoHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();

  await sharp(fullFrame)
    .composite([{ input: bar, left: barX, top: barY }])
    .png()
    .toFile(pngPath);

  return pngPath;
}

export async function renderReel(reelId: string): Promise<RenderResult> {
  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);
  if (!reel.originalVideo) throw new Error('No original video to render');

  const reelDir = getReelDirectory(reelId);
  const outputPath = path.join(reelDir, 'processed.mp4');
  const brandingPath = path.join(getAppPaths().assetsDir, 'branding-plate.png');

  const videoInfo = await getVideoInfo(reel.originalVideo);
  const overlayFiles: string[] = [];

  const ffmpegArgs: string[] = ['-i', reel.originalVideo];
  const filterSteps: string[] = [];
  let currentLabel = '0:v';
  let inputIdx = 1;

  // Text overlay
  if (reel.finalText) {
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

    ffmpegArgs.push('-i', overlayPath);
    overlayFiles.push(overlayPath);
    filterSteps.push(`[${currentLabel}][${inputIdx}:v]overlay=0:0:format=auto[v${inputIdx}]`);
    currentLabel = `v${inputIdx}`;
    inputIdx++;
  }

  // Branding overlay
  if (fs.existsSync(brandingPath)) {
    ffmpegArgs.push('-i', brandingPath);
    filterSteps.push(`[${inputIdx}:v]scale=${Math.round(videoInfo.width * 0.15)}:-1[brand]`);
    filterSteps.push(`[${currentLabel}][brand]overlay=W-w-20:H-h-20[v${inputIdx}]`);
    currentLabel = `v${inputIdx}`;
    inputIdx++;
  }

  if (filterSteps.length > 0) {
    // Remove output label from last step (becomes default output)
    const lastIdx = filterSteps.length - 1;
    filterSteps[lastIdx] = filterSteps[lastIdx].replace(/\[v\d+\]$/, '');
    ffmpegArgs.push('-filter_complex', filterSteps.join(';'));
    ffmpegArgs.push('-map', '0:a?');
  }

  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  );

  try {
    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 300_000 });
  } finally {
    for (const f of overlayFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg did not produce output file');
  }

  return { videoPath: outputPath };
}
