import type { Telegram } from 'telegraf';
import { telegramifyMarkdown } from './markdown.js';
import { splitMessage } from './split.js';

export async function sendResponse(telegram: Telegram, chatId: number, content: string): Promise<void> {
  const formatted = telegramifyMarkdown(content);
  const chunks = splitMessage(formatted, 4096);

  for (const chunk of chunks) {
    try {
      await telegram.sendMessage(chatId, chunk, {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("can't parse entities")) {
        await telegram.sendMessage(chatId, chunk, {
          link_preview_options: { is_disabled: true },
        });
      } else {
        throw err;
      }
    }
  }
}

export async function sendProvisional(telegram: Telegram, chatId: number, text: string): Promise<number> {
  const res = await telegram.sendMessage(chatId, text);
  return res.message_id;
}

export async function editMessage(telegram: Telegram, chatId: number, messageId: number, content: string): Promise<void> {
  const formatted = telegramifyMarkdown(content);
  try {
    await telegram.editMessageText(chatId, messageId, undefined, formatted, {
      parse_mode: 'MarkdownV2',
    });
  } catch {
    await telegram.editMessageText(chatId, messageId, undefined, content);
  }
}
