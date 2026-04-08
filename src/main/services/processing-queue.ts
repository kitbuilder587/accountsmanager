import { processReel } from './reel-pipeline.js';
import { listReels, updateReelStatus } from './reel-repository.js';
import type { ReelStatus } from '../../shared/reel.js';

interface QueueItem {
  reelId: string;
  startFrom?: string;
}

const queue: QueueItem[] = [];
let isProcessing = false;

const PROCESSING_STATUSES = ['downloading', 'ocr', 'classifying', 'generating', 'rendering', 'publishing'];

export function enqueueReel(reelId: string, startFrom?: string): void {
  queue.push({ reelId, startFrom });
  void processNext();
}

async function processNext(): Promise<void> {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const item = queue.shift()!;

  try {
    await processReel(item.reelId, item.startFrom);
  } catch (error) {
    console.error(`[Queue] Failed to process reel ${item.reelId}:`, error);
  } finally {
    isProcessing = false;
    void processNext();
  }
}

export function getQueueLength(): number {
  return queue.length;
}

/**
 * On startup, find reels stuck in processing states from a previous run
 * and reset them to error so they can be retried.
 */
export function recoverStuckReels(): void {
  let recovered = 0;

  for (const status of PROCESSING_STATUSES) {
    const stuck = listReels(status);
    for (const reel of stuck) {
      console.log(`[Queue] Recovering stuck reel ${reel.id} (was: ${reel.status})`);
      updateReelStatus(reel.id, 'error' as ReelStatus, {
        errorStage: reel.status,
        errorMessage: 'Server restarted while processing — retry to continue',
      });
      recovered++;
    }
  }

  if (recovered > 0) {
    console.log(`[Queue] Recovered ${recovered} stuck reel(s)`);
  }
}
