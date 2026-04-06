#!/usr/bin/env node
/**
 * Test the reel pipeline with a local video file.
 * Skips downloading — goes straight to OCR → text generation → rendering.
 *
 * Usage:
 *   node scripts/test-local-video.mjs /path/to/video.mp4 [custom-text]
 *
 * Requirements (must be available in PATH or via env vars):
 *   - ffmpeg, ffprobe
 *   - PaddleOCR API running (set PADDLEOCR_URL, default http://localhost:8866)
 *     OR tesseract CLI as fallback
 *   - OpenRouter API key (set OPENROUTER_API_KEY)
 *     Not needed if custom-text is provided
 *
 * Output:
 *   The processed video will be at: .accountsmanager-data/reels/<id>/processed.mp4
 */

import fs from 'node:fs';
import path from 'node:path';

const videoPath = process.argv[2];
const customText = process.argv[3] || undefined;

if (!videoPath) {
  console.error('Usage: node scripts/test-local-video.mjs <video.mp4> [custom-text]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/test-local-video.mjs ./my-reel.mp4');
  console.error('  node scripts/test-local-video.mjs ./my-reel.mp4 "Мой кастомный текст"');
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`Error: File not found: ${videoPath}`);
  process.exit(1);
}

const absVideoPath = path.resolve(videoPath);
console.log('');
console.log('=== Reel Pipeline Test ===');
console.log(`Video:       ${absVideoPath}`);
console.log(`Custom text: ${customText || '(will auto-detect via OCR + translate)'}`);
console.log('');

// Import after arg validation so errors are clear
const { createReel, updateReelStatus, getReelById, getReelDirectory } = await import('../dist/src/main/services/reel-repository.js');
const { processReel } = await import('../dist/src/main/services/reel-pipeline.js');

// Step 1: Create reel record
const reel = createReel({
  sourceUrl: `file://${absVideoPath}`,
  customText,
});
console.log(`[1] Created reel: ${reel.id}`);

// Step 2: Copy video to reel directory (skip download)
const reelDir = getReelDirectory(reel.id);
const originalPath = path.join(reelDir, 'original.mp4');
fs.copyFileSync(absVideoPath, originalPath);
console.log(`[2] Copied video to ${originalPath}`);

// Step 3: Update reel to mark download as done
updateReelStatus(reel.id, 'downloading', {
  originalVideo: originalPath,
  thumbnail: null,
});

// Extract thumbnail
const { execFile } = await import('node:child_process');
const { promisify } = await import('node:util');
const execFileAsync = promisify(execFile);
const thumbnailPath = path.join(reelDir, 'thumbnail.jpg');

try {
  await execFileAsync('ffmpeg', ['-i', originalPath, '-vframes', '1', '-q:v', '2', '-y', thumbnailPath], { timeout: 15000 });
  updateReelStatus(reel.id, 'downloading', {
    originalVideo: originalPath,
    thumbnail: thumbnailPath,
  });
  console.log(`[2] Extracted thumbnail`);
} catch (e) {
  console.log(`[2] Thumbnail extraction skipped: ${e.message}`);
}

// Step 4: Run pipeline from OCR stage
console.log(`[3] Running pipeline (OCR → Generate → Render)...`);
console.log('');

await processReel(reel.id, 'ocr');

// Step 5: Show results
const result = getReelById(reel.id);
console.log('');
console.log('=== Results ===');
console.log(`Status:         ${result.status}`);

if (result.status === 'error') {
  console.log(`Error stage:    ${result.errorStage}`);
  console.log(`Error:          ${result.errorMessage}`);
  console.log('');
  console.log('Troubleshooting:');
  if (result.errorStage === 'ocr') {
    console.log('  - Is PaddleOCR running? Set PADDLEOCR_URL=http://localhost:8866');
    console.log('  - Fallback: install tesseract (apt install tesseract-ocr tesseract-ocr-rus)');
    console.log('  - Is ffmpeg installed? (needed to extract frames)');
  } else if (result.errorStage === 'generating') {
    console.log('  - Set OPENROUTER_API_KEY env var');
    console.log('  - Or provide custom text: node scripts/test-local-video.mjs video.mp4 "текст"');
  } else if (result.errorStage === 'rendering') {
    console.log('  - Is ffmpeg installed?');
    console.log('  - Check font path: FONT_PATH env var');
  }
  process.exit(1);
}

console.log(`Original text:  ${result.originalText || '(none detected)'}`);
console.log(`Generated text: ${result.generatedText || '(none)'}`);
console.log(`Final text:     ${result.finalText || '(none)'}`);

if (result.textRegionX !== null) {
  console.log(`Text region:    x=${result.textRegionX} y=${result.textRegionY} w=${result.textRegionW} h=${result.textRegionH}`);
}

console.log('');
console.log('=== Output Files ===');
const files = ['original.mp4', 'processed.mp4', 'thumbnail.jpg'];
for (const file of files) {
  const fp = path.join(reelDir, file);
  if (fs.existsSync(fp)) {
    const size = fs.statSync(fp).size;
    const sizeStr = size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(1)} MB`
      : `${(size / 1024).toFixed(1)} KB`;
    console.log(`  ${file.padEnd(16)} ${sizeStr.padStart(10)}   ${fp}`);
  }
}

if (result.processedVideo && fs.existsSync(result.processedVideo)) {
  console.log('');
  console.log(`>>> Open processed video: ${result.processedVideo}`);
}

process.exit(0);
