import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
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
 * Creates a full-frame transparent PNG overlay entirely via canvas (Skia).
 * No sharp compositing — avoids alpha channel incompatibilities across platforms.
 */
function createFullFrameOverlay(
  text: string,
  videoWidth: number,
  videoHeight: number,
  region: { x: number; y: number; w: number; h: number } | null,
): string {
  const tmpDir = path.join(getAppPaths().reelsDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngPath = path.join(tmpDir, `text-${Date.now()}.png`);

  const fontSize = region
    ? Math.max(14, Math.min(42, Math.round(region.h * 0.5)))
    : Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));

  const barW = region ? region.w : videoWidth;
  const barH = region ? region.h : Math.round(fontSize * 1.3 + 48);
  const barX = region ? region.x : 0;
  const barY = region ? region.y : videoHeight - barH - 40;

  // Create full-frame canvas and draw everything in one pass
  const canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext('2d');

  // Dark bar background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
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

  fs.writeFileSync(pngPath, Buffer.from(canvas.toBuffer('image/png')));
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

    const overlayPath = createFullFrameOverlay(
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

  console.log(`[Renderer] ffmpeg ${ffmpegArgs.join(' ')}`);
  for (const f of overlayFiles) {
    const size = fs.existsSync(f) ? fs.statSync(f).size : 0;
    console.log(`[Renderer] Overlay: ${f} (${size} bytes)`);
  }

  try {
    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 300_000 });
  } finally {
    // Keep overlay for debugging — user can inspect it
    for (const f of overlayFiles) {
      console.log(`[Renderer] Overlay saved for inspection: ${f}`);
    }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg did not produce output file');
  }

  return { videoPath: outputPath };
}
