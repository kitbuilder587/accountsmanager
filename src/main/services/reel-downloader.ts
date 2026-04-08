import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

import { getReelById, getReelDirectory } from './reel-repository.js';

const execFileAsync = promisify(execFile);

interface DownloadResult {
  videoPath: string;
  thumbnailPath: string;
}

export async function downloadReel(reelId: string): Promise<DownloadResult> {
  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);

  const reelDir = getReelDirectory(reelId);
  const videoPath = path.join(reelDir, 'original.mp4');
  const thumbnailPath = path.join(reelDir, 'thumbnail.jpg');

  // Download video using yt-dlp
  await execFileAsync('yt-dlp', [
    '-o', videoPath,
    '--format', 'best[ext=mp4]/best',
    '--no-playlist',
    '--max-filesize', '100M',
    reel.sourceUrl,
  ], { timeout: 120_000 });

  if (!fs.existsSync(videoPath)) {
    throw new Error('yt-dlp did not produce output file');
  }

  // Extract thumbnail from first frame
  try {
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      thumbnailPath,
    ], { timeout: 30_000 });
  } catch {
    // Thumbnail extraction is non-critical
    console.warn(`[Downloader] Could not extract thumbnail for reel ${reelId}`);
  }

  return { videoPath, thumbnailPath };
}
