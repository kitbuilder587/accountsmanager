import { getReelById, updateReelStatus, updateReelError } from './reel-repository.js';
import { downloadReel } from './reel-downloader.js';
import { detectText } from './reel-ocr.js';
import { classifyRegions } from './reel-region-classifier.js';
import { generateText } from './reel-text-generator.js';
import { renderReel } from './reel-renderer.js';

type PipelineStage = 'downloading' | 'ocr' | 'classifying' | 'generating' | 'rendering';

const STAGE_ORDER: PipelineStage[] = ['downloading', 'ocr', 'classifying', 'generating', 'rendering'];

export async function processReel(reelId: string, startFrom?: string): Promise<void> {
  const reel = getReelById(reelId);
  if (!reel) {
    console.error(`[Pipeline] Reel not found: ${reelId}`);
    return;
  }

  const mappedStart = startFrom === 'pending' ? 'downloading' : startFrom;
  const startIndex = mappedStart
    ? STAGE_ORDER.indexOf(mappedStart as PipelineStage)
    : 0;

  const stages = STAGE_ORDER.slice(Math.max(0, startIndex));

  for (const stage of stages) {
    try {
      switch (stage) {
        case 'downloading': {
          updateReelStatus(reelId, 'downloading');
          console.log(`[Pipeline] Downloading reel ${reelId}...`);
          const downloadResult = await downloadReel(reelId);
          updateReelStatus(reelId, 'downloading', {
            originalVideo: downloadResult.videoPath,
            thumbnail: downloadResult.thumbnailPath,
          });
          break;
        }

        case 'ocr': {
          updateReelStatus(reelId, 'ocr');
          console.log(`[Pipeline] Running OCR on reel ${reelId}...`);
          const ocrResult = await detectText(reelId);
          const allText = ocrResult.regions.map(r => r.text).join('\n');

          // Save mid_frame as thumbnail if we don't have one
          const currentReel = getReelById(reelId)!;
          const framePath = ocrResult.framePath;

          updateReelStatus(reelId, 'ocr', {
            originalText: allText || null,
            detectedRegions: JSON.stringify(ocrResult.regions),
          });

          // Keep frame for classifier (don't clean up here)
          break;
        }

        case 'classifying': {
          const currentReel = getReelById(reelId)!;
          const regions = currentReel.detectedRegions || [];

          if (regions.length > 0 && regions.some(r => r.w > 0)) {
            updateReelStatus(reelId, 'classifying');
            console.log(`[Pipeline] Classifying ${regions.length} text regions for reel ${reelId}...`);

            // Get frame path for vision
            const reelDir = (await import('./reel-repository.js')).getReelDirectory(reelId);
            const framePath = (await import('node:path')).join(reelDir, 'frames', 'mid_frame.png');
            const fs = await import('node:fs');

            let classifiedRegions = regions;
            if (fs.existsSync(framePath)) {
              classifiedRegions = await classifyRegions(regions, framePath);
            } else {
              console.warn('[Pipeline] No frame available for classifier, using defaults');
            }

            updateReelStatus(reelId, 'classifying', {
              detectedRegions: JSON.stringify(classifiedRegions),
            });

            // Clean up frames
            const framesDir = (await import('node:path')).dirname(framePath);
            try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* */ }
          }

          // Pause pipeline at review — user approves in admin
          updateReelStatus(reelId, 'review');
          console.log(`[Pipeline] Reel ${reelId} waiting for review`);
          return; // Stop here, user resumes via /approve
        }

        case 'generating': {
          const currentReel = getReelById(reelId)!;

          // Find the "replace" region text
          const replaceRegions = (currentReel.detectedRegions || []).filter(r => r.action === 'replace');
          const replaceText = replaceRegions.map(r => r.text).join('\n');

          if (currentReel.customText) {
            updateReelStatus(reelId, 'generating', {
              finalText: currentReel.customText,
            });
          } else if (replaceText) {
            updateReelStatus(reelId, 'generating');
            console.log(`[Pipeline] Generating text for reel ${reelId}...`);
            const generated = await generateText(replaceText);
            updateReelStatus(reelId, 'generating', {
              generatedText: generated,
              finalText: generated,
            });
          } else if (currentReel.originalText) {
            updateReelStatus(reelId, 'generating');
            const generated = await generateText(currentReel.originalText);
            updateReelStatus(reelId, 'generating', {
              generatedText: generated,
              finalText: generated,
            });
          } else {
            updateReelStatus(reelId, 'generating', {
              finalText: null,
            });
          }
          break;
        }

        case 'rendering': {
          updateReelStatus(reelId, 'rendering');
          console.log(`[Pipeline] Rendering reel ${reelId}...`);
          const renderResult = await renderReel(reelId);
          updateReelStatus(reelId, 'ready', {
            processedVideo: renderResult.videoPath,
          });
          console.log(`[Pipeline] Reel ${reelId} is ready!`);
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Pipeline] Error at stage ${stage} for reel ${reelId}:`, message);
      updateReelError(reelId, stage, message);
      return;
    }
  }
}
