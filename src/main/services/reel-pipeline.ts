import { getReelById, updateReelStatus, updateReelError } from './reel-repository.js';
import { downloadReel } from './reel-downloader.js';
import { detectText } from './reel-ocr.js';
import { generateText } from './reel-text-generator.js';
import { renderReel } from './reel-renderer.js';

type PipelineStage = 'downloading' | 'ocr' | 'generating' | 'rendering';

const STAGE_ORDER: PipelineStage[] = ['downloading', 'ocr', 'generating', 'rendering'];

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
          updateReelStatus(reelId, 'ocr', {
            originalText: ocrResult.text,
            textRegionX: ocrResult.region?.x ?? null,
            textRegionY: ocrResult.region?.y ?? null,
            textRegionW: ocrResult.region?.w ?? null,
            textRegionH: ocrResult.region?.h ?? null,
          });
          break;
        }

        case 'generating': {
          const currentReel = getReelById(reelId)!;
          if (currentReel.customText) {
            updateReelStatus(reelId, 'generating', {
              finalText: currentReel.customText,
            });
          } else if (currentReel.originalText) {
            updateReelStatus(reelId, 'generating');
            console.log(`[Pipeline] Generating text for reel ${reelId}...`);
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
