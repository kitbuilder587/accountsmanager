import { getDueJobs, updatePublishJobStatus } from './publish-job-repository.js';
import { getReelById } from './reel-repository.js';
import { publishReel } from './reel-publisher.js';

const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds
let isRunning = false;

async function processDueJobs(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const dueJobs = getDueJobs();
    if (dueJobs.length === 0) return;

    console.log(`[Scheduler] Found ${dueJobs.length} due publish job(s)`);

    for (const job of dueJobs) {
      const reel = getReelById(job.reelId);
      if (!reel) {
        updatePublishJobStatus(job.id, 'error', {
          errorMessage: `Reel ${job.reelId} not found`,
        });
        continue;
      }

      if (reel.status !== 'ready') {
        updatePublishJobStatus(job.id, 'error', {
          errorMessage: `Reel is not ready (status: ${reel.status})`,
        });
        continue;
      }

      try {
        updatePublishJobStatus(job.id, 'publishing');
        await publishReel(reel.id, job.profileId, job.platform as 'youtube' | 'instagram');
        updatePublishJobStatus(job.id, 'published', {
          publishedAt: new Date().toISOString(),
        });
        console.log(`[Scheduler] Job ${job.id} published successfully`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updatePublishJobStatus(job.id, 'error', {
          errorMessage: message,
          retryCount: job.retryCount + 1,
        });
        console.error(`[Scheduler] Job ${job.id} failed:`, message);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing jobs:', error);
  } finally {
    isRunning = false;
  }
}

export function startPublishScheduler(): void {
  console.log('[Scheduler] Publish job scheduler started (polling every 30s)');
  setInterval(() => {
    void processDueJobs();
  }, POLL_INTERVAL_MS);

  // Also run once on startup
  void processDueJobs();
}
