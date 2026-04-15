import type { ChatMessage, ChatSearchResult, FileListEntry, SearchResult } from './types.js';

export class HiveClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', ...extra };
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this.headers(init?.headers as Record<string, string>),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Hive API error ${res.status}: ${await res.text()}`);
    }
    return res;
  }

  async getRecentMessages(space: string, thread: string, limit: number): Promise<ChatMessage[]> {
    const res = await this.request(`/data/${space}/messages?thread=${encodeURIComponent(thread)}&limit=${limit}&order=desc`);
    if (res.status === 404) return [];
    const messages: ChatMessage[] = await res.json();
    return messages.reverse();
  }

  async postMessage(space: string, body: { thread: string; author: string; content: string; source?: string }): Promise<ChatMessage> {
    const res = await this.request(`/data/${space}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async searchMessages(space: string, query: string): Promise<ChatSearchResult[]> {
    const res = await this.request(`/data/${space}/search?q=${encodeURIComponent(query)}`);
    if (res.status === 404) return [];
    return res.json();
  }

  async readFile(space: string, path: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/data/${space}/files/${encodeURIComponent(path)}`, {
      headers: this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Hive API error ${res.status}: ${await res.text()}`);
    return res.text();
  }

  async writeFile(space: string, path: string, content: string): Promise<void> {
    await this.request(`/data/${space}/files/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async appendFile(space: string, path: string, content: string): Promise<void> {
    await this.request(`/data/${space}/files/${encodeURIComponent(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async listFiles(space: string, prefix?: string): Promise<FileListEntry[]> {
    const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const res = await this.request(`/data/${space}/files${q}`);
    if (res.status === 404) return [];
    return res.json();
  }

  async searchFiles(space: string, query: string): Promise<SearchResult[]> {
    const res = await this.request(`/data/${space}/search?q=${encodeURIComponent(query)}`);
    if (res.status === 404) return [];
    return res.json();
  }
}
