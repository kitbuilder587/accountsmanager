import { getReelById, updateReelStatus } from './reel-repository.js';

// Publishing locks per profile to prevent concurrent publishes
const publishLocks = new Set<string>();

export async function publishReel(
  reelId: string,
  profileId: string,
  platform: 'youtube' | 'instagram',
): Promise<void> {
  if (publishLocks.has(profileId)) {
    throw new Error(`Profile ${profileId} is already publishing`);
  }

  const reel = getReelById(reelId);
  if (!reel) throw new Error(`Reel not found: ${reelId}`);
  if (!reel.processedVideo) throw new Error('No processed video');

  publishLocks.add(profileId);

  try {
    updateReelStatus(reelId, 'publishing', {
      publishedProfileId: profileId,
      publishedPlatform: platform,
    });

    // Playwright CDP publishing will be implemented in Phase E
    // For now, mark as needing manual publishing
    console.log(`[Publisher] Reel ${reelId} ready for manual publishing via profile ${profileId} on ${platform}`);
    console.log(`[Publisher] Video path: ${reel.processedVideo}`);

    // TODO: Implement Playwright CDP connection
    // 1. Connect to Chrome via CDP on the profile's debug port
    // 2. Navigate to upload page
    // 3. Upload video file
    // 4. Fill in metadata
    // 5. Submit

    updateReelStatus(reelId, 'ready', {
      publishError: 'Automated publishing not yet implemented. Use manual publishing.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateReelStatus(reelId, 'error', {
      errorStage: 'publishing',
      errorMessage: message,
      publishError: message,
    });
  } finally {
    publishLocks.delete(profileId);
  }
}
