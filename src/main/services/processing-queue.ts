import { processReel } from './reel-pipeline.js';

interface QueueItem {
  reelId: string;
  startFrom?: string;
}

const queue: QueueItem[] = [];
let isProcessing = false;

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
