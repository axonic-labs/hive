import { describe, it, expect, vi } from 'vitest';
import { createTools } from '../../src/llm/tools.js';
import type { HiveClient } from '../../src/hive/client.js';

describe('createTools', () => {
  const mockClient = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    listFiles: vi.fn(),
    searchFiles: vi.fn(),
    searchMessages: vi.fn(),
  } as unknown as HiveClient;

  it('returns all expected tool names', () => {
    const tools = createTools(mockClient, 'notes', 'diary');
    const names = Object.keys(tools);
    expect(names).toContain('read_note');
    expect(names).toContain('write_note');
    expect(names).toContain('append_note');
    expect(names).toContain('list_notes');
    expect(names).toContain('search_notes');
    expect(names).toContain('search_chat_history');
  });

  it('read_note calls hive client with correct args', async () => {
    (mockClient.readFile as any).mockResolvedValue('# Content');
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.read_note.execute!({ path: 'goals.md' }, {} as any);
    expect(mockClient.readFile).toHaveBeenCalledWith('notes', 'goals.md');
    expect(result).toContain('# Content');
  });

  it('read_note returns not-found message for missing files', async () => {
    (mockClient.readFile as any).mockResolvedValue(null);
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.read_note.execute!({ path: 'missing.md' }, {} as any);
    expect(result).toContain('not found');
  });

  it('write_note calls hive client with path and content', async () => {
    (mockClient.writeFile as any).mockResolvedValue(undefined);
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.write_note.execute!({ path: 'new.md', content: 'hello' }, {} as any);
    expect(mockClient.writeFile).toHaveBeenCalledWith('notes', 'new.md', 'hello');
    expect(result).toContain('Written');
  });

  it('list_notes joins path and filename correctly for nested files', async () => {
    (mockClient.listFiles as any).mockResolvedValue([
      { id: '1', path: '', filename: 'elias.md', created_at: '', updated_at: '' },
      { id: '2', path: 'work/projects', filename: 'hive.md', created_at: '', updated_at: '' },
    ]);
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.list_notes.execute!({}, {} as any);
    expect(result).toBe('elias.md\nwork/projects/hive.md');
  });

  it('search_notes joins path and filename correctly for nested files', async () => {
    (mockClient.searchFiles as any).mockResolvedValue([
      { id: '1', path: 'work/projects', filename: 'hive.md', created_at: '', updated_at: '', headline: 'matched text', rank: 0.95 },
    ]);
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.search_notes.execute!({ query: 'hive' }, {} as any);
    expect(result).toContain('**work/projects/hive.md**');
  });

  it('search_chat_history calls hive client', async () => {
    (mockClient.searchMessages as any).mockResolvedValue([
      { content: 'found it', headline: '<b>found</b> it', rank: 1, thread: 't', author: 'user', id: '1', source: null, created_by: null, created_at: '' },
    ]);
    const tools = createTools(mockClient, 'notes', 'diary');
    const result = await tools.search_chat_history.execute!({ query: 'found' }, {} as any);
    expect(mockClient.searchMessages).toHaveBeenCalledWith('diary', 'found');
    expect(result).toContain('found');
  });
});
