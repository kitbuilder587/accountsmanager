import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { getAppPaths } from './main/services/app-paths.js';
import { profilesRouter } from './main/routes/profiles.js';
import { reelsRouter } from './main/routes/reels.js';
import { startTelegramBot } from './main/services/telegram-bot.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/profiles', profilesRouter);
app.use('/api/reels', reelsRouter);

// Serve reel media files
app.use('/media/reels', express.static(getAppPaths().reelsDir));

// Serve frontend in production
const rendererDir = path.resolve('dist/renderer');
app.use(express.static(rendererDir));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(rendererDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Accounts Manager running on http://localhost:${PORT}`);
});

// Start Telegram bot if token is configured
if (process.env.TELEGRAM_BOT_TOKEN) {
  startTelegramBot();
} else {
  console.log('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
}
