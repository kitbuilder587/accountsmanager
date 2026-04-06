import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { getReelById, getReelDirectory, updateReelStatus } from './reel-repository.js';
import { getAppPaths } from './app-paths.js';

const publishLocks = new Set<string>();

function getCookiePath(profileId: string, platform: string): string {
  const dir = path.join(getAppPaths().profilesDir, profileId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${platform}-cookies.json`);
}

// ─── YouTube Shorts Upload ───────────────────────────────────────────

async function uploadToYouTube(
  videoPath: string,
  title: string,
  description: string,
  cookiePath: string,
): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  let context: BrowserContext;

  // Load cookies if they exist
  if (fs.existsSync(cookiePath)) {
    context = await browser.newContext({ storageState: cookiePath });
  } else {
    context = await browser.newContext();
  }

  const page = await context.newPage();

  try {
    // Navigate to YouTube Studio upload
    await page.goto('https://studio.youtube.com/channel/UC/videos/upload?d=ud');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('/signin')) {
      console.log('[YouTube] Login required. Please log in manually in the browser window...');
      // Wait for user to complete login (up to 5 minutes)
      await page.waitForURL('**/studio.youtube.com/**', { timeout: 300_000 });
      console.log('[YouTube] Login successful');
    }

    // Navigate to upload page
    await page.goto('https://studio.youtube.com/channel/UC/videos/upload?d=ud');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Click "Upload videos" button or find the file input
    const uploadButton = page.locator('ytcp-button#upload-button, button#upload-button');
    if (await uploadButton.count() > 0) {
      // Use file chooser pattern
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10_000 }),
        uploadButton.click(),
      ]);
      await fileChooser.setFiles(videoPath);
    } else {
      // Try direct input method
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(videoPath);
    }

    console.log('[YouTube] Video file selected, waiting for upload...');

    // Wait for upload dialog to appear
    await page.waitForSelector('#dialog, ytcp-uploads-dialog', { timeout: 30_000 });

    // Fill title
    const titleInput = page.locator('#textbox[aria-label="Add a title that describes your video (type @ to mention a channel)"], #title-textarea textbox, div[id="textbox"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10_000 });
    await titleInput.click();
    await page.keyboard.press('Control+A');
    await titleInput.fill(title);

    // Fill description
    const descInput = page.locator('#textbox[aria-label="Tell viewers about your video (type @ to mention a channel)"], #description-textarea textbox').first();
    if (await descInput.count() > 0) {
      await descInput.click();
      await descInput.fill(description);
    }

    // Set as "Not made for kids"
    const notForKids = page.locator('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]');
    if (await notForKids.count() > 0) {
      await notForKids.click();
    }

    // Click through Next buttons (Details → Video elements → Checks → Visibility)
    for (let step = 0; step < 3; step++) {
      const nextBtn = page.locator('#next-button, ytcp-button#next-button');
      await nextBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await nextBtn.click();
      await page.waitForTimeout(1500);
    }

    // Select Public visibility
    const publicRadio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"]');
    if (await publicRadio.count() > 0) {
      await publicRadio.click();
    }

    // Wait for upload to complete before publishing
    // Look for "Upload complete" or check processing status
    await page.waitForTimeout(3000);

    // Click Publish/Done
    const publishBtn = page.locator('#done-button, ytcp-button#done-button');
    await publishBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await publishBtn.click();

    console.log('[YouTube] Video published!');

    // Wait for confirmation
    await page.waitForTimeout(3000);

    // Save cookies for next time
    await context.storageState({ path: cookiePath });
    console.log('[YouTube] Cookies saved');

  } finally {
    await context.close();
    await browser.close();
  }
}

// ─── Instagram Reels Upload ──────────────────────────────────────────

async function uploadToInstagram(
  videoPath: string,
  caption: string,
  cookiePath: string,
): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  let context: BrowserContext;

  if (fs.existsSync(cookiePath)) {
    context = await browser.newContext({
      storageState: cookiePath,
      viewport: { width: 430, height: 932 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
  } else {
    context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
  }

  const page = await context.newPage();

  try {
    await page.goto('https://www.instagram.com/');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Check if login is needed
    const loginBtn = page.locator('button:has-text("Log in"), a:has-text("Log in")');
    if (await loginBtn.count() > 0) {
      console.log('[Instagram] Login required. Please log in manually...');
      await page.waitForURL('**/instagram.com/**', { timeout: 300_000 });
      // Wait until feed loads (indicating successful login)
      await page.waitForSelector('svg[aria-label="Home"], nav', { timeout: 60_000 });
      console.log('[Instagram] Login successful');
    }

    // Click the Create/New post button (+ icon)
    const createBtn = page.locator('svg[aria-label="New post"], a[href="/create/select/"]').first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
    } else {
      // Try bottom navigation create button
      const bottomCreate = page.locator('a[href="/create/"], div[role="menuitem"]:has-text("Create")');
      await bottomCreate.first().click();
    }

    await page.waitForTimeout(2000);

    // Select file
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    if (await fileInput.count() === 0) {
      // Sometimes hidden, try the general file input
      const anyFileInput = page.locator('input[type="file"]').first();
      await anyFileInput.setInputFiles(videoPath);
    } else {
      await fileInput.setInputFiles(videoPath);
    }

    console.log('[Instagram] Video file selected');
    await page.waitForTimeout(3000);

    // Click through to the caption/share step
    // "Next" button
    for (let i = 0; i < 2; i++) {
      const nextBtn = page.locator('button:has-text("Next"), div[role="button"]:has-text("Next")').first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Fill caption
    const captionInput = page.locator('textarea[aria-label="Write a caption..."], div[aria-label="Write a caption..."]').first();
    if (await captionInput.count() > 0) {
      await captionInput.click();
      await page.keyboard.type(caption, { delay: 30 });
    }

    // Click Share/Publish
    const shareBtn = page.locator('button:has-text("Share"), div[role="button"]:has-text("Share")').first();
    await shareBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await shareBtn.click();

    console.log('[Instagram] Reel shared!');

    // Wait for confirmation
    await page.waitForTimeout(5000);

    // Save cookies
    await context.storageState({ path: cookiePath });
    console.log('[Instagram] Cookies saved');

  } finally {
    await context.close();
    await browser.close();
  }
}

// ─── Main Publisher ──────────────────────────────────────────────────

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

    const cookiePath = getCookiePath(profileId, platform);
    const title = reel.finalText || 'New video';
    const description = `${title}\n\n#shorts #reels`;

    console.log(`[Publisher] Publishing reel ${reelId} to ${platform} via profile ${profileId}`);

    if (platform === 'youtube') {
      await uploadToYouTube(reel.processedVideo, title, description, cookiePath);
    } else {
      await uploadToInstagram(reel.processedVideo, `${title}\n\n#reels`, cookiePath);
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
