import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { HiveClient } from '../hive/client.js';

export function createTools(hive: HiveClient, notesSpace: string, chatSpace: string): ToolSet {
  return {
    read_note: tool({
      description: 'Read a note/file from the wiki. Use this to look up goals, context, decisions, or any stored knowledge. Pass the full file path (e.g. "elias.md", "work/projects/hive.md").',
      inputSchema: z.object({
        path: z.string().describe('File path relative to the notes space root'),
      }),
      execute: async ({ path }) => {
        const content = await hive.readFile(notesSpace, path);
        if (content === null) return `File "${path}" not found.`;
        return content;
      },
    }),

    write_note: tool({
      description: 'Create or overwrite a note in the wiki. Use this to persist decisions, goals, summaries, or any information worth remembering long-term.',
      inputSchema: z.object({
        path: z.string().describe('File path (e.g. "journal/2026-04-06.md", "work/decisions.md")'),
        content: z.string().describe('Full file content in Markdown'),
      }),
      execute: async ({ path, content }) => {
        await hive.writeFile(notesSpace, path, content);
        return `Written to "${path}".`;
      },
    }),

    append_note: tool({
      description: 'Append content to an existing note. Use this to add entries to logs, journals, or running lists without overwriting.',
      inputSchema: z.object({
        path: z.string().describe('File path to append to'),
        content: z.string().describe('Content to append (newline added automatically)'),
      }),
      execute: async ({ path, content }) => {
        await hive.appendFile(notesSpace, path, content);
        return `Appended to "${path}".`;
      },
    }),

    list_notes: tool({
      description: 'List files in the wiki, optionally filtered by folder prefix. Use this to discover what notes exist.',
      inputSchema: z.object({
        prefix: z.string().optional().describe('Folder prefix to filter by (e.g. "work/", "personal/")'),
      }),
      execute: async ({ prefix }) => {
        const files = await hive.listFiles(notesSpace, prefix);
        if (files.length === 0) return prefix ? `No files found under "${prefix}".` : 'No files found.';
        return files.map((f) => f.path ? `${f.path}/${f.filename}` : f.filename).join('\n');
      },
    }),

    search_notes: tool({
      description: 'Full-text search across all notes in the wiki. Use this to find relevant context before responding to questions about goals, decisions, or stored knowledge.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => {
        const results = await hive.searchFiles(notesSpace, query);
        if (results.length === 0) return `No notes found matching "${query}".`;
        return results.map((r) => `**${r.path ? `${r.path}/${r.filename}` : r.filename}** (relevance: ${r.rank.toFixed(2)})\n${r.headline}`).join('\n\n');
      },
    }),

    search_chat_history: tool({
      description: 'Search through past conversation messages. Use this to recall previous discussions, decisions made in conversation, or things the user mentioned before.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => {
        const results = await hive.searchMessages(chatSpace, query);
        if (results.length === 0) return `No messages found matching "${query}".`;
        return results.map((r) => `[${r.author} at ${r.created_at}]: ${r.content}`).join('\n\n');
      },
    }),
  };
}
