import TelegramBot from 'node-telegram-bot-api';

import { createReel, getReelById } from './reel-repository.js';
import { enqueueReel } from './processing-queue.js';

let bot: TelegramBot | null = null;

const INSTAGRAM_REEL_PATTERN = /https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i;
const TIKTOK_PATTERN = /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[\w\/@.-]+/i;

function extractUrl(text: string): string | null {
  const patterns = [INSTAGRAM_REEL_PATTERN, TIKTOK_PATTERN];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  // Generic URL fallback
  const urlMatch = text.match(/https?:\/\/\S+/i);
  return urlMatch ? urlMatch[0] : null;
}

function extractCustomText(text: string, url: string): string | undefined {
  const remaining = text.replace(url, '').trim();
  return remaining.length > 0 ? remaining : undefined;
}

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set, bot disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.on('polling_error', (error) => {
    console.error('[Telegram] Polling error:', error.message);
  });

  bot.onText(/\/start/, (msg) => {
    bot?.sendMessage(msg.chat.id,
      'Send me an Instagram Reel or TikTok link and I will repackage it with Russian text and CheapGPT.ru branding.\n\n' +
      'You can also add custom text after the link:\n' +
      '`https://instagram.com/reel/abc123 Your custom text here`',
      { parse_mode: 'Markdown' },
    ).catch((err) => console.error('[Telegram] Failed to send /start reply:', err.message));
  });

  bot.onText(/\/status/, async (msg) => {
    bot?.sendMessage(msg.chat.id, 'Check the admin panel for reel statuses: http://localhost:3001/reels')
      .catch((err) => console.error('[Telegram] Failed to send /status reply:', err.message));
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const url = extractUrl(msg.text);

    if (!url) {
      await bot?.sendMessage(chatId, 'Please send a valid Instagram Reel or TikTok link.');
      return;
    }

    const customText = extractCustomText(msg.text, url);

    try {
      const reel = createReel({
        sourceUrl: url,
        customText,
        telegramChatId: String(chatId),
        telegramMessageId: String(msg.message_id),
      });

      await bot?.sendMessage(chatId,
        `Reel queued for processing!\n` +
        `ID: \`${reel.id}\`\n` +
        `Status: ${reel.status}\n` +
        (customText ? `Custom text: ${customText}` : 'Text will be auto-generated from video'),
        { parse_mode: 'Markdown' },
      );

      enqueueReel(reel.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await bot?.sendMessage(chatId, `Failed to queue reel: ${message}`);
    }
  });

  console.log('[Telegram] Bot started with long polling');
}

export function notifyReelReady(reelId: string): void {
  if (!bot) return;

  const reel = getReelById(reelId);
  if (!reel?.telegramChatId) return;

  bot.sendMessage(
    reel.telegramChatId,
    `Reel processed and ready!\n` +
    `ID: \`${reel.id}\`\n` +
    `Text: ${reel.finalText || '(no text)'}\n` +
    `View in admin: http://localhost:3001/reels`,
    { parse_mode: 'Markdown' },
  ).catch((error) => {
    console.error(`[Telegram] Failed to notify about reel ${reelId}:`, error);
  });
}

export function stopTelegramBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}
