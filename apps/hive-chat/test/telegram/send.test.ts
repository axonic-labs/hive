import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendResponse, sendProvisional, editMessage } from '../../src/telegram/send.js';
import type { Telegram } from 'telegraf';

function makeTelegram(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 42, chat: { id: 1 } }),
    editMessageText: vi.fn().mockResolvedValue({}),
    sendChatAction: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as Telegram;
}

describe('sendResponse', () => {
  let telegram: Telegram;

  beforeEach(() => {
    telegram = makeTelegram();
  });

  it('sends with parse_mode MarkdownV2', async () => {
    await sendResponse(telegram, 123, 'Hello **world**');
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      123,
      expect.any(String),
      expect.objectContaining({ parse_mode: 'MarkdownV2' })
    );
  });

  it('falls back to plain text when sendMessage throws "can\'t parse entities"', async () => {
    const error = new Error("Bad Request: can't parse entities");
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ message_id: 99 });
    telegram = makeTelegram({ sendMessage });

    await sendResponse(telegram, 123, 'some content');

    expect(sendMessage).toHaveBeenCalledTimes(2);
    // Second call has no parse_mode
    expect(sendMessage.mock.calls[1][2]).not.toHaveProperty('parse_mode');
  });

  it('rethrows errors that are not parse entity errors', async () => {
    const error = new Error('Network error');
    telegram = makeTelegram({ sendMessage: vi.fn().mockRejectedValue(error) });

    await expect(sendResponse(telegram, 123, 'hello')).rejects.toThrow('Network error');
  });

  it('splits long messages into multiple sends', async () => {
    const longContent = 'x'.repeat(9000);
    await sendResponse(telegram, 123, longContent);

    expect(telegram.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('disables link preview', async () => {
    await sendResponse(telegram, 123, 'Hello');
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      123,
      expect.any(String),
      expect.objectContaining({ link_preview_options: { is_disabled: true } })
    );
  });
});

describe('sendProvisional', () => {
  it('sends a plain message and returns message_id', async () => {
    const telegram = makeTelegram({
      sendMessage: vi.fn().mockResolvedValue({ message_id: 77 }),
    });

    const id = await sendProvisional(telegram, 456, 'Thinking...');
    expect(id).toBe(77);
    expect(telegram.sendMessage).toHaveBeenCalledWith(456, 'Thinking...');
  });
});

describe('editMessage', () => {
  it('edits with MarkdownV2', async () => {
    const telegram = makeTelegram();
    await editMessage(telegram, 123, 42, 'Updated content');
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      123,
      42,
      undefined,
      expect.any(String),
      expect.objectContaining({ parse_mode: 'MarkdownV2' })
    );
  });

  it('falls back to plain text on parse error', async () => {
    const editMessageText = vi.fn()
      .mockRejectedValueOnce(new Error("can't parse entities"))
      .mockResolvedValueOnce({});
    const telegram = makeTelegram({ editMessageText });

    await editMessage(telegram, 123, 42, 'some *broken* content');

    expect(editMessageText).toHaveBeenCalledTimes(2);
    // Second call has no options
    expect(editMessageText.mock.calls[1][4]).toBeUndefined();
  });
});
