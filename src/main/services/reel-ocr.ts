import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import type { DetectedRegion } from '../../shared/reel.js';
import { getReelById, getReelDirectory } from './reel-repository.js';

const execFileAsync = promisify(execFile);

const PADDLEOCR_URL = process.env.PADDLEOCR_URL || 'http://localhost:8866';

export interface OcrResult {
  regions: DetectedRegion[];
  framePath: string;
}

export async function extractMiddleFrame(reelId: string): Promise<string> {
  const reel = getReelById(reelId);
  if (!reel?.originalVideo) throw new Error('No original video');

  const reelDir = getReelDirectory(reelId);
  const framesDir = path.join(reelDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const framePath = path.join(framesDir, 'mid_frame.png');

  const { stdout: durationStr } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    reel.originalVideo,
  ], { timeout: 15_000 });

  const duration = parseFloat(durationStr.trim()) || 5;
  const midTime = Math.min(duration / 2, 3);

  await execFileAsync('ffmpeg', [
    '-i', reel.originalVideo,
    '-ss', String(midTime),
    '-vframes', '1',
    '-y',
    framePath,
  ], { timeout: 15_000 });

  return framePath;
}

async function callPaddleOcr(imagePath: string): Promise<DetectedRegion[]> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(`${PADDLEOCR_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    throw new Error(`PaddleOCR API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    results: Array<{
      text: string;
      confidence: number;
      bbox: number[][];
    }>;
  };

  if (!data.results || data.results.length === 0) {
    return [];
  }

  const regions: DetectedRegion[] = [];
  const padding = 8;

  for (const result of data.results) {
    if (result.confidence < 0.5) continue;

    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    for (const point of result.bbox) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }

    regions.push({
      id: randomUUID().slice(0, 8),
      x: Math.max(0, Math.round(minX) - padding),
      y: Math.max(0, Math.round(minY) - padding),
      w: Math.round(maxX - minX) + padding * 2,
      h: Math.round(maxY - minY) + padding * 2,
      text: result.text,
      confidence: Math.round(result.confidence * 100) / 100,
      action: 'mask', // default — LLM classifier will refine
    });
  }

  return regions;
}

export async function detectText(reelId: string): Promise<OcrResult> {
  const framePath = await extractMiddleFrame(reelId);

  try {
    const regions = await callPaddleOcr(framePath);
    const allText = regions.map(r => r.text).join('\n');
    return { regions, framePath };
  } catch (error) {
    console.warn(`[OCR] PaddleOCR unavailable, falling back to Tesseract:`, error);

    // Tesseract fallback — text only, no coordinates
    try {
      const { stdout } = await execFileAsync('tesseract', [
        framePath, 'stdout', '-l', 'eng+rus',
      ], { timeout: 30_000 });

      const text = stdout.trim();
      if (text) {
        return {
          regions: [{
            id: randomUUID().slice(0, 8),
            x: 0, y: 0, w: 0, h: 0,
            text,
            confidence: 0.5,
            action: 'keep', // no bbox = can't mask
          }],
          framePath,
        };
      }
    } catch { /* ignore */ }

    return { regions: [], framePath };
  }
}
