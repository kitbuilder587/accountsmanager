import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

import { getReelById, getReelDirectory } from './reel-repository.js';
import { getAppPaths } from './app-paths.js';

const execFileAsync = promisify(execFile);

const FONT_PATH = process.env.FONT_PATH || '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf';

interface RenderResult {
  videoPath: string;
}

function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

export async function renderReel(reelId: string): Promise<RenderResult> {
  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);
  if (!reel.originalVideo) throw new Error('No original video to render');

  const reelDir = getReelDirectory(reelId);
  const outputPath = path.join(reelDir, 'processed.mp4');
  const brandingPath = path.join(getAppPaths().assetsDir, 'branding-plate.png');

  const filters: string[] = [];
  const fontFilter = fs.existsSync(FONT_PATH) ? `:fontfile='${FONT_PATH}'` : '';

  if (reel.finalText) {
    const escapedText = escapeFFmpegText(reel.finalText);
    const hasRegion = reel.textRegionX !== null && reel.textRegionY !== null &&
      reel.textRegionW !== null && reel.textRegionH !== null;

    if (hasRegion) {
      // OCR found text region — replace in-place
      filters.push(
        `drawbox=x=${reel.textRegionX}:y=${reel.textRegionY}:w=${reel.textRegionW}:h=${reel.textRegionH}:color=black@0.85:t=fill`
      );

      const fontSize = Math.max(16, Math.min(48, Math.round(reel.textRegionH! * 0.6)));
      const textX = reel.textRegionX! + 10;
      const textY = reel.textRegionY! + Math.round((reel.textRegionH! - fontSize) / 2);

      filters.push(
        `drawtext=text='${escapedText}':x=${textX}:y=${textY}:fontsize=${fontSize}:fontcolor=white${fontFilter}`
      );
    } else {
      // No OCR region — draw text centered near bottom with semi-transparent background
      const fontSize = 36;
      const boxPadding = 16;

      // Dark semi-transparent box behind text, centered at bottom
      filters.push(
        `drawtext=text='${escapedText}':x=(w-text_w)/2:y=h-th-${boxPadding * 4}:fontsize=${fontSize}:fontcolor=white${fontFilter}:box=1:boxcolor=black@0.7:boxborderw=${boxPadding}`
      );
    }
  }

  // Build FFmpeg command
  const ffmpegArgs: string[] = ['-i', reel.originalVideo];

  // Add branding overlay if the asset exists
  if (fs.existsSync(brandingPath)) {
    ffmpegArgs.push('-i', brandingPath);

    // Complex filter: apply text replacement, then overlay branding at bottom-right
    const textFilter = filters.length > 0 ? filters.join(',') + ',' : '';
    const complexFilter = `[0:v]${textFilter}scale=iw:ih[base];[1:v]scale=iw*0.15:-1[brand];[base][brand]overlay=W-w-20:H-h-20`;
    ffmpegArgs.push('-filter_complex', complexFilter);
  } else if (filters.length > 0) {
    // Simple video filter without branding overlay
    ffmpegArgs.push('-vf', filters.join(','));
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

  await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 300_000 });

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg did not produce output file');
  }

  return { videoPath: outputPath };
}
