import 'dotenv/config';
import express from 'express';
import { config } from './config.js';
import { HiveClient } from './hive/client.js';
import { setupBot } from './bot/webhook.js';

const app = express();
const hive = new HiveClient(config.hiveApiUrl, config.hiveApiKey);

const bot = setupBot(config.telegramBotToken, {
  hive,
  geminiApiKey: config.geminiApiKey,
  chatSpace: config.chatSpace,
  notesSpace: config.notesSpace,
  chatThread: config.chatThread,
  anchorFile: config.anchorFile,
  contextMessageCount: config.contextMessageCount,
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', bot: 'elias' });
});

// Telegram webhook
const webhookPath = `/webhook/${config.webhookSecret}`;
app.use(express.json());
app.post(webhookPath, (req, res) => {
  bot.handleUpdate(req.body, res);
});

async function start() {
  const webhookUrl = `${config.webhookUrl}${webhookPath}`;

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook set to ${webhookUrl}`);
  } catch (err) {
    console.error('Failed to set webhook:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Elias listening on port ${config.port}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  bot.telegram.deleteWebhook().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  bot.telegram.deleteWebhook().then(() => process.exit(0));
});

start();
