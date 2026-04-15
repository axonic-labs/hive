import { Telegraf } from 'telegraf';
import type { HandlerDeps } from './handlers.js';
import { handleTextMessage, handleVoiceMessage } from './handlers.js';

export function setupBot(token: string, deps: Omit<HandlerDeps, 'telegram'>, contactMap: Map<number, string>): Telegraf {
  const bot = new Telegraf(token);
  const fullDeps: HandlerDeps = { ...deps, telegram: bot.telegram };

  bot.on('text', async (ctx) => {
    if (!contactMap.has(ctx.chat.id)) return;
    await handleTextMessage(fullDeps, ctx.chat.id, ctx.message.text);
  });

  bot.on('voice', async (ctx) => {
    if (!contactMap.has(ctx.chat.id)) return;
    await handleVoiceMessage(fullDeps, ctx.chat.id, ctx.message.voice.file_id);
  });

  bot.catch((err) => {
    console.error('Telegraf error:', err);
  });

  return bot;
}
