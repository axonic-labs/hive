import { z } from 'zod';
import { listSpaceNames, getSpaceConfig } from '../config/manager.js';
import { getUserGrantsForSpace } from '../middleware/permissions.js';

// Tools map typed loosely to avoid AI SDK generic gymnastics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = { description: string; parameters: z.ZodType<any>; execute: (args: any) => Promise<any> };

export function generateAgentTools(userId: string, baseUrl: string, apiKey: string): Record<string, AnyTool> {
  const tools: Record<string, AnyTool> = {};
  const hdrs = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  for (const space of listSpaceNames()) {
    const grants = getUserGrantsForSpace(userId, space);
    if (grants.length === 0) continue;

    const config = getSpaceConfig(space);
    if (!config) continue;

    const schema = config.kind || 'files';
    const hasWrite = grants.some(g => g.access === 'read_write');
    const p = space.replace(/-/g, '_');

    if (schema === 'files') {
      tools[`${p}_list_files`] = {
        description: `List files in the "${space}" space. Optionally filter by folder prefix.`,
        parameters: z.object({ prefix: z.string().optional().describe('Folder path prefix') }),
        execute: async (args: { prefix?: string }) => {
          const res = await fetch(`${baseUrl}/api/data/${space}/files${args.prefix ? `?prefix=${encodeURIComponent(args.prefix)}` : ''}`, { headers: hdrs });
          return res.json();
        },
      };
      tools[`${p}_read_file`] = {
        description: `Read a file in the "${space}" space.`,
        parameters: z.object({ path: z.string().describe('File path e.g. "journal/2026-04-05.md"') }),
        execute: async (args: { path: string }) => {
          const res = await fetch(`${baseUrl}/api/data/${space}/files/${args.path}`, { headers: hdrs });
          return res.text();
        },
      };
      tools[`${p}_search`] = {
        description: `Full-text search in the "${space}" space.`,
        parameters: z.object({ query: z.string().describe('Search query') }),
        execute: async (args: { query: string }) => {
          const res = await fetch(`${baseUrl}/api/data/${space}/search?q=${encodeURIComponent(args.query)}`, { headers: hdrs });
          return res.json();
        },
      };
      if (hasWrite) {
        tools[`${p}_write_file`] = {
          description: `Write (create or overwrite) a file in the "${space}" space.`,
          parameters: z.object({ path: z.string().describe('File path'), content: z.string().describe('Content') }),
          execute: async (args: { path: string; content: string }) => {
            const res = await fetch(`${baseUrl}/api/data/${space}/files/${args.path}`, { method: 'PUT', headers: hdrs, body: JSON.stringify({ content: args.content }) });
            return res.json();
          },
        };
        tools[`${p}_append_file`] = {
          description: `Append text to a file in the "${space}" space. Auto-newline. Creates if missing.`,
          parameters: z.object({ path: z.string().describe('File path'), content: z.string().describe('Text to append') }),
          execute: async (args: { path: string; content: string }) => {
            const res = await fetch(`${baseUrl}/api/data/${space}/files/${args.path}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ content: args.content }) });
            return res.json();
          },
        };
      }
    }

    if (schema === 'chatlog') {
      tools[`${p}_list_threads`] = {
        description: `List conversation threads in the "${space}" space.`,
        parameters: z.object({}),
        execute: async () => {
          const res = await fetch(`${baseUrl}/api/data/${space}/threads`, { headers: hdrs });
          return res.json();
        },
      };
      tools[`${p}_list_messages`] = {
        description: `List messages in a thread in the "${space}" space.`,
        parameters: z.object({ thread: z.string().describe('Thread name'), limit: z.number().optional().describe('Max messages') }),
        execute: async (args: { thread: string; limit?: number }) => {
          const res = await fetch(`${baseUrl}/api/data/${space}/messages?thread=${encodeURIComponent(args.thread)}${args.limit ? `&limit=${args.limit}` : ''}`, { headers: hdrs });
          return res.json();
        },
      };
      tools[`${p}_search_messages`] = {
        description: `Search messages in the "${space}" space.`,
        parameters: z.object({ query: z.string().describe('Search query') }),
        execute: async (args: { query: string }) => {
          const res = await fetch(`${baseUrl}/api/data/${space}/search?q=${encodeURIComponent(args.query)}`, { headers: hdrs });
          return res.json();
        },
      };
      if (hasWrite) {
        tools[`${p}_post_message`] = {
          description: `Post a message to a thread in the "${space}" space.`,
          parameters: z.object({ thread: z.string().describe('Thread name'), author: z.string().describe('Author role'), content: z.string().describe('Message content') }),
          execute: async (args: { thread: string; author: string; content: string }) => {
            const res = await fetch(`${baseUrl}/api/data/${space}/messages`, { method: 'POST', headers: hdrs, body: JSON.stringify(args) });
            return res.json();
          },
        };
      }
    }
  }

  return tools;
}
