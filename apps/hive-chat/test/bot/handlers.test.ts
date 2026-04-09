import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTextMessage } from '../../src/bot/handlers.js';
import type { HiveClient } from '../../src/hive/client.js';

// Mock the generate module
vi.mock('../../src/llm/generate.js', () => ({
  generateResponse: vi.fn().mockResolvedValue({ text: 'Elias says hi', usage: { promptTokens: 10, completionTokens: 5 } }),
}));

describe('handleTextMessage', () => {
  const mockHive = {
    postMessage: vi.fn().mockResolvedValue({ id: '1' }),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue('# Goals\n- test'),
    searchMessages: vi.fn().mockResolvedValue([]),
    writeFile: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    searchFiles: vi.fn().mockResolvedValue([]),
  } as unknown as HiveClient;

  const mockTelegram = {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    editMessageText: vi.fn().mockResolvedValue({}),
    sendChatAction: vi.fn().mockResolvedValue({}),
    deleteMessage: vi.fn().mockResolvedValue({}),
  };

  const deps = {
    hive: mockHive,
    telegram: mockTelegram as any,
    geminiApiKey: 'test-key',
    chatSpace: 'diary',
    notesSpace: 'notes',
    chatThread: 'hive-chat',
    anchorFile: 'elias.md',
    contextMessageCount: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockHive.getRecentMessages as any).mockResolvedValue([]);
    (mockHive.readFile as any).mockResolvedValue('# Goals');
    (mockHive.postMessage as any).mockResolvedValue({ id: '1' });
  });

  it('stores user message in hive', async () => {
    await handleTextMessage(deps, 123, 'hello');

    expect(mockHive.postMessage).toHaveBeenCalledWith('diary', {
      thread: 'hive-chat',
      author: 'user',
      content: 'hello',
      source: 'telegram',
    });
  });

  it('fetches recent messages for context', async () => {
    await handleTextMessage(deps, 123, 'hello');

    expect(mockHive.getRecentMessages).toHaveBeenCalledWith('diary', 'hive-chat', 30);
  });

  it('reads anchor file for system prompt', async () => {
    await handleTextMessage(deps, 123, 'hello');

    expect(mockHive.readFile).toHaveBeenCalledWith('notes', 'elias.md');
  });

  it('stores assistant response in hive', async () => {
    await handleTextMessage(deps, 123, 'hello');

    // Second postMessage call is the assistant response
    const calls = (mockHive.postMessage as any).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[1]).toEqual(['diary', {
      thread: 'hive-chat',
      author: 'assistant',
      content: 'Elias says hi',
    }]);
  });

  it('sends response to telegram', async () => {
    await handleTextMessage(deps, 123, 'hello');

    expect(mockTelegram.sendMessage).toHaveBeenCalled();
  });

  it('sends error message to telegram on hive context failure', async () => {
    (mockHive.getRecentMessages as any).mockRejectedValue(new Error('Hive down'));

    await handleTextMessage(deps, 123, 'hello');

    // Should inform user AND still try to respond
    const calls = mockTelegram.sendMessage.mock.calls;
    const hasErrorMsg = calls.some((c: any) => /can't reach|error|trouble/i.test(c[1]));
    expect(hasErrorMsg).toBe(true);
  });
});
