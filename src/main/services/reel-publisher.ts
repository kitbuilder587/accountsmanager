import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { getReelById, getReelDirectory, updateReelStatus } from './reel-repository.js';
import { getAppPaths } from './app-paths.js';

const execFileAsync = promisify(execFile);
const publishLocks = new Set<string>();

function getCookiePath(profileId: string, platform: string): string {
  const dir = path.join(getAppPaths().profilesDir, profileId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${platform}-cookies.json`);
}

// ─── YouTube Shorts Upload (based on fawazahmed0/youtube-uploader selectors) ──

async function uploadToYouTube(
  videoPath: string,
  title: string,
  description: string,
  cookiePath: string,
): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const contextOptions: any = {};

  if (fs.existsSync(cookiePath)) {
    contextOptions.storageState = cookiePath;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  try {
    const uploadURL = 'https://studio.youtube.com/channel/UC/videos/upload?d=ud';
    await page.goto(uploadURL);
    await page.waitForLoadState('networkidle');

    // If redirected to login, wait for manual login
    if (page.url().includes('accounts.google.com')) {
      console.log('[YouTube] Login required — please log in manually in the browser window');
      await page.waitForURL('**/studio.youtube.com/**', { timeout: 300_000 });
      await page.waitForLoadState('networkidle');
    }

    // Wait for upload dialog
    const uploadPopupSelector = 'ytcp-uploads-dialog';
    await page.waitForSelector(uploadPopupSelector, { timeout: 30_000 });

    // Upload file via file chooser
    const selectFilesBtn = page.locator('ytcp-button#select-files-button');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      selectFilesBtn.click(),
    ]);
    await fileChooser.setFiles(videoPath);
    console.log('[YouTube] Video file selected, uploading...');

    // Wait for title input to become editable
    await page.waitForTimeout(2000);

    // Clear and set title (contenteditable textbox)
    const titleInput = page.locator('#textbox[aria-label*="title"], div#title-input #textbox').first();
    await titleInput.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type(title, { delay: 30 });

    // Set description
    const descInput = page.locator('#textbox[aria-label*="description"], div#description-input #textbox').first();
    if (await descInput.count() > 0) {
      await descInput.click();
      await page.keyboard.type(description, { delay: 20 });
    }

    // Select "Not made for kids" radio
    const notForKids = page.locator("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']");
    if (await notForKids.count() > 0) {
      await notForKids.click();
    }

    // Click Next 3 times (Details → Elements → Checks → Visibility)
    for (let step = 0; step < 3; step++) {
      await page.waitForTimeout(1500);
      await page.click('#next-button');
    }

    // Select Public visibility
    await page.waitForTimeout(1000);
    const publicRadio = page.locator("tp-yt-paper-radio-button[name='PUBLIC']");
    if (await publicRadio.count() > 0) {
      await publicRadio.click();
    }

    // Wait for upload to finish (done button becomes enabled)
    const doneButton = page.locator('#done-button');
    await doneButton.waitFor({ state: 'visible' });

    // Wait until upload processing completes (button not disabled)
    for (let i = 0; i < 60; i++) {
      const disabled = await doneButton.getAttribute('disabled');
      if (disabled === null) break;
      console.log('[YouTube] Waiting for upload to complete...');
      await page.waitForTimeout(3000);
    }

    await doneButton.click();
    console.log('[YouTube] Publish clicked!');

    // Wait for success confirmation
    await page.waitForTimeout(5000);

    // Save cookies
    await context.storageState({ path: cookiePath });
    console.log('[YouTube] Cookies saved, upload complete');

  } finally {
    await context.close();
    await browser.close();
  }
}

// ─── Instagram Reels Upload (via instagrapi Python subprocess) ──────

async function uploadToInstagram(
  videoPath: string,
  caption: string,
  profileId: string,
): Promise<void> {
  const sessionPath = getCookiePath(profileId, 'instagram-session');
  const scriptPath = path.resolve('scripts/instagram-upload.py');

  if (!fs.existsSync(scriptPath)) {
    throw new Error('Instagram upload script not found. Expected at: scripts/instagram-upload.py');
  }

  const username = process.env.INSTAGRAM_USERNAME || '';
  const password = process.env.INSTAGRAM_PASSWORD || '';

  const args = [
    scriptPath,
    '--video', videoPath,
    '--caption', caption,
    '--session', sessionPath,
  ];

  if (username) args.push('--username', username);
  if (password) args.push('--password', password);

  console.log('[Instagram] Starting upload via instagrapi...');

  const { stdout, stderr } = await execFileAsync('python3', args, {
    timeout: 300_000,
    env: { ...process.env },
  });

  if (stderr) {
    console.log('[Instagram] stderr:', stderr);
  }

  const result = JSON.parse(stdout.trim());

  if (!result.success) {
    throw new Error(result.error || 'Instagram upload failed');
  }

  console.log(`[Instagram] Published! URL: ${result.url}`);
}

// ─── Main Publisher ─────────────────────────────────────────────────

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

    const title = reel.finalText || 'New video';
    const description = `${title}\n\n#shorts #reels`;

    console.log(`[Publisher] Publishing reel ${reelId} to ${platform}...`);

    if (platform === 'youtube') {
      const cookiePath = getCookiePath(profileId, 'youtube');
      await uploadToYouTube(reel.processedVideo, title, description, cookiePath);
    } else {
      const caption = `${title}\n\n#reels #viral`;
      await uploadToInstagram(reel.processedVideo, caption, profileId);
    }

    updateReelStatus(reelId, 'published', {
      publishedAt: new Date().toISOString(),
    });

    console.log(`[Publisher] Reel ${reelId} published to ${platform}!`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Publisher] Failed:`, message);
    updateReelStatus(reelId, 'error', {
      errorStage: 'publishing',
      errorMessage: message,
      publishError: message,
    });
  } finally {
    publishLocks.delete(profileId);
  }
}
