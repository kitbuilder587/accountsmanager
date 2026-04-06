import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

import { getReelById, getReelDirectory } from './reel-repository.js';

const execFileAsync = promisify(execFile);

const PADDLEOCR_URL = process.env.PADDLEOCR_URL || 'http://localhost:8866';

interface TextRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface OcrResult {
  text: string | null;
  region: TextRegion | null;
}

async function extractMiddleFrame(reelId: string): Promise<string> {
  const reel = getReelById(reelId);
  if (!reel?.originalVideo) throw new Error('No original video');

  const reelDir = getReelDirectory(reelId);
  const framesDir = path.join(reelDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const framePath = path.join(framesDir, 'mid_frame.png');

  // Get video duration
  const { stdout: durationStr } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    reel.originalVideo,
  ], { timeout: 15_000 });

  const duration = parseFloat(durationStr.trim()) || 5;
  const midTime = Math.min(duration / 2, 3);

  // Extract frame at midpoint
  await execFileAsync('ffmpeg', [
    '-i', reel.originalVideo,
    '-ss', String(midTime),
    '-vframes', '1',
    '-y',
    framePath,
  ], { timeout: 15_000 });

  return framePath;
}

async function callPaddleOcr(imagePath: string): Promise<OcrResult> {
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
    return { text: null, region: null };
  }

  // Combine all detected text regions
  const texts: string[] = [];
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

  for (const result of data.results) {
    if (result.confidence < 0.5) continue;
    texts.push(result.text);

    for (const point of result.bbox) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }
  }

  if (texts.length === 0) {
    return { text: null, region: null };
  }

  // Add padding to the region
  const padding = 10;
  const region: TextRegion = {
    x: Math.max(0, Math.round(minX) - padding),
    y: Math.max(0, Math.round(minY) - padding),
    w: Math.round(maxX - minX) + padding * 2,
    h: Math.round(maxY - minY) + padding * 2,
  };

  return {
    text: texts.join('\n'),
    region,
  };
}

async function callTesseractFallback(imagePath: string): Promise<OcrResult> {
  // Fallback: use tesseract CLI if available
  try {
    const { stdout } = await execFileAsync('tesseract', [
      imagePath, 'stdout', '-l', 'eng+rus',
    ], { timeout: 30_000 });

    const text = stdout.trim();
    return { text: text || null, region: null };
  } catch {
    return { text: null, region: null };
  }
}

export async function detectText(reelId: string): Promise<OcrResult> {
  const framePath = await extractMiddleFrame(reelId);

  try {
    return await callPaddleOcr(framePath);
  } catch (error) {
    console.warn(`[OCR] PaddleOCR unavailable, falling back to Tesseract:`, error);
    return await callTesseractFallback(framePath);
  } finally {
    // Clean up frames directory
    const framesDir = path.dirname(framePath);
    try {
      fs.rmSync(framesDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}
