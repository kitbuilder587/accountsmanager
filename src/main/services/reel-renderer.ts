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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

  const escaped = escapeXml(text);

  if (options.position === 'region' && options.regionW && options.regionH) {
    // Text fits inside the detected OCR region
    const w = options.regionW;
    const h = options.regionH;
    const fontSize = Math.max(14, Math.min(42, Math.round(h * 0.5)));

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" rx="4"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        fill="white" font-size="${fontSize}" font-family="sans-serif">${escaped}</text>
</svg>`;

    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    return { pngPath, overlayWidth: w, overlayHeight: h };
  }

  // Center-bottom: full-width bar at bottom
  const padding = 20;
  const fontSize = Math.max(20, Math.min(40, Math.round(videoWidth * 0.045)));
  const barHeight = fontSize + padding * 2 + 10;
  const barWidth = videoWidth;

  // Wrap long text into multiple lines
  const maxCharsPerLine = Math.floor(barWidth / (fontSize * 0.55));
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = fontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const finalBarHeight = Math.round(totalTextHeight + padding * 2 + 10);

  const textElements = lines.map((line, i) => {
    const y = padding + fontSize + i * lineHeight;
    return `<text x="50%" y="${y}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="sans-serif">${escapeXml(line)}</text>`;
  }).join('\n  ');

  const svg = `<svg width="${barWidth}" height="${finalBarHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" rx="8"/>
  ${textElements}
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  return { pngPath, overlayWidth: barWidth, overlayHeight: finalBarHeight };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
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
