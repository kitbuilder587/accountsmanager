#!/usr/bin/env node
/**
 * Debug script: generates the text overlay PNG and runs ffmpeg manually.
 * Shows every step so we can find where it breaks.
 *
 * Usage: node scripts/debug-render.mjs <video.mp4> <text>
 */
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const videoPath = process.argv[2];
const text = process.argv[3] || 'Тестовый текст';

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error('Usage: node scripts/debug-render.mjs <video.mp4> <text>');
  process.exit(1);
}

const absVideo = path.resolve(videoPath);
const outDir = path.resolve('.debug-render');
fs.mkdirSync(outDir, { recursive: true });

const overlayPng = path.join(outDir, 'overlay.png');
const outputMp4 = path.join(outDir, 'output.mp4');

// Step 1: Get video dimensions
console.log('[1] Getting video info...');
const { stdout } = await execFileAsync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height',
  '-of', 'csv=p=0', absVideo,
]);
const [width, height] = stdout.trim().split(',').map(Number);
console.log(`    Video: ${width}x${height}`);

// Step 2: Generate full-frame overlay PNG (transparent except text bar at bottom)
console.log('[2] Generating overlay PNG...');
const fontSize = 32;
const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textBuf = await sharp({
  text: {
    text: `<span foreground="white" font_desc="Sans Bold ${fontSize}">${escaped}</span>`,
    rgba: true,
    width: width - 60,
    align: 'centre',
  },
}).png().toBuffer();

const textMeta = await sharp(textBuf).metadata();
console.log(`    Text rendered: ${textMeta.width}x${textMeta.height}`);

const barH = textMeta.height + 48;
const barY = height - barH - 40;

// Create full-frame transparent PNG
const fullFrame = await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).png().toBuffer();

// Create the dark bar
const bar = await sharp({
  create: { width, height: barH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 180 } },
})
  .composite([{ input: textBuf, gravity: 'centre' }])
  .png()
  .toBuffer();

// Composite bar onto full frame
await sharp(fullFrame)
  .composite([{ input: bar, left: 0, top: barY }])
  .png()
  .toFile(overlayPng);

const pngSize = fs.statSync(overlayPng).size;
console.log(`    Overlay PNG: ${overlayPng} (${(pngSize / 1024).toFixed(1)} KB)`);
console.log(`    Bar position: y=${barY}, height=${barH}`);
console.log(`    INSPECT THIS FILE to verify text is visible!`);

// Step 3: Run ffmpeg
console.log('[3] Running ffmpeg...');
const ffmpegCmd = [
  '-i', absVideo,
  '-i', overlayPng,
  '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto',
  '-c:a', 'copy',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-y', outputMp4,
];

console.log(`    ffmpeg ${ffmpegCmd.join(' ')}`);
console.log('');

try {
  const { stderr } = await execFileAsync('ffmpeg', ffmpegCmd, { timeout: 120_000 });
  // ffmpeg outputs to stderr
  const lines = stderr.split('\n').filter(l => l.includes('Error') || l.includes('error'));
  if (lines.length > 0) {
    console.log('    FFMPEG ERRORS:');
    lines.forEach(l => console.log('    ' + l));
  }
} catch (err) {
  console.error('    FFMPEG FAILED:', err.stderr || err.message);
  process.exit(1);
}

const outSize = fs.statSync(outputMp4).size;
console.log(`[4] Output: ${outputMp4} (${(outSize / 1024).toFixed(1)} KB)`);
console.log('');
console.log('CHECK THESE FILES:');
console.log(`  1. Overlay PNG (should show text): open ${overlayPng}`);
console.log(`  2. Output video:                   open ${outputMp4}`);
