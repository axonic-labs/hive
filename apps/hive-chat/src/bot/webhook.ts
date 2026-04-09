import { Telegraf } from 'telegraf';
import type { HandlerDeps } from './handlers.js';
import { handleTextMessage, handleVoiceMessage } from './handlers.js';

export function setupBot(token: string, deps: Omit<HandlerDeps, 'telegram'>): Telegraf {
  const bot = new Telegraf(token);
  const fullDeps: HandlerDeps = { ...deps, telegram: bot.telegram };

  bot.on('text', async (ctx) => {
    await handleTextMessage(fullDeps, ctx.chat.id, ctx.message.text);
  });

  bot.on('voice', async (ctx) => {
    await handleVoiceMessage(fullDeps, ctx.chat.id, ctx.message.voice.file_id);
  });

  bot.catch((err) => {
    console.error('Telegraf error:', err);
  });

  return bot;
}
