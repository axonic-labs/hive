import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HiveClient } from '../../src/hive/client.js';

const BASE_URL = 'https://hive.yaneq.com/api';
const API_KEY = 'test-api-key';
const SPACE = 'my-space';

function mockFetch(status: number, body: unknown, isText = false) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(isText ? body : JSON.stringify(body)),
  });
}

describe('HiveClient', () => {
  let client: HiveClient;

  beforeEach(() => {
    client = new HiveClient(BASE_URL, API_KEY);
    vi.restoreAllMocks();
  });

  describe('getRecentMessages', () => {
    it('calls GET /data/{space}/messages with correct params and reverses result', async () => {
      const messages = [
        { id: '2', thread: 'general', author: 'bob', source: null, content: 'second', created_by: null, created_at: '2024-01-02' },
        { id: '1', thread: 'general', author: 'alice', source: null, content: 'first', created_by: null, created_at: '2024-01-01' },
      ];
      global.fetch = mockFetch(200, messages);

      const result = await client.getRecentMessages(SPACE, 'general', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/messages?thread=general&limit=10&order=desc`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      // Should be reversed to chronological order
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });
  });

  describe('postMessage', () => {
    it('calls POST /data/{space}/messages with JSON body', async () => {
      const created = { id: '3', thread: 'general', author: 'alice', source: null, content: 'hello', created_by: null, created_at: '2024-01-03' };
      global.fetch = mockFetch(200, created);

      const body = { thread: 'general', author: 'alice', content: 'hello' };
      const result = await client.postMessage(SPACE, body);

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      expect(result.id).toBe('3');
    });
  });

  describe('readFile', () => {
    it('calls GET /data/{space}/files/{path} and returns text content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('file content here'),
      });

      const result = await client.readFile(SPACE, 'notes/todo.md');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/files/${encodeURIComponent('notes/todo.md')}`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      expect(result).toBe('file content here');
    });

    it('returns null for 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
      });

      const result = await client.readFile(SPACE, 'missing.md');
      expect(result).toBeNull();
    });

    it('throws on non-404 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('internal error'),
      });

      await expect(client.readFile(SPACE, 'bad.md')).rejects.toThrow('Hive API error 500');
    });
  });

  describe('writeFile', () => {
    it('calls PUT /data/{space}/files/{path} with JSON body', async () => {
      global.fetch = mockFetch(200, {});

      await client.writeFile(SPACE, 'notes/todo.md', 'content here');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/files/${encodeURIComponent('notes/todo.md')}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ content: 'content here' }),
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
    });
  });

  describe('appendFile', () => {
    it('calls PATCH /data/{space}/files/{path} with JSON body', async () => {
      global.fetch = mockFetch(200, {});

      await client.appendFile(SPACE, 'notes/log.md', 'new line');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/files/${encodeURIComponent('notes/log.md')}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ content: 'new line' }),
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
    });
  });

  describe('listFiles', () => {
    it('calls GET /data/{space}/files without prefix', async () => {
      const files = [{ id: '1', path: 'notes/a.md', filename: 'a.md', created_at: '2024-01-01', updated_at: '2024-01-01' }];
      global.fetch = mockFetch(200, files);

      const result = await client.listFiles(SPACE);

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/files`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      expect(result).toEqual(files);
    });

    it('calls GET /data/{space}/files?prefix={prefix} when prefix provided', async () => {
      global.fetch = mockFetch(200, []);

      await client.listFiles(SPACE, 'notes/');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/files?prefix=${encodeURIComponent('notes/')}`,
        expect.anything(),
      );
    });
  });

  describe('searchFiles', () => {
    it('calls GET /data/{space}/search?q={query}', async () => {
      const results = [{ id: '1', path: 'a.md', filename: 'a.md', created_at: '', updated_at: '', headline: 'match', rank: 0.9 }];
      global.fetch = mockFetch(200, results);

      const result = await client.searchFiles(SPACE, 'hello world');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/search?q=${encodeURIComponent('hello world')}`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      expect(result).toEqual(results);
    });
  });

  describe('searchMessages', () => {
    it('calls GET /data/{space}/search?q={query}', async () => {
      const results = [
        { id: '1', thread: 'general', author: 'alice', source: null, content: 'hello', created_by: null, created_at: '', headline: 'match', rank: 0.8 },
      ];
      global.fetch = mockFetch(200, results);

      const result = await client.searchMessages(SPACE, 'hello');

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/data/${SPACE}/search?q=${encodeURIComponent('hello')}`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
      expect(result).toEqual(results);
    });
  });

  describe('error handling', () => {
    it('throws with status on non-OK responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('forbidden'),
      });

      await expect(client.listFiles(SPACE)).rejects.toThrow('Hive API error 403');
    });

    it('does not throw on 404 from request() — only from readFile direct fetch', async () => {
      // The private request() method allows 404 through (returns response)
      // so methods like listFiles won't throw on 404, they'll return whatever json() gives
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve([]),
        text: () => Promise.resolve('not found'),
      });

      const result = await client.listFiles(SPACE);
      expect(result).toEqual([]);
    });
  });
});
