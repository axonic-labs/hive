import type pg from 'pg';
import { chatTableName } from './spaces.js';
import type { ChatMessage, ThreadSummary } from '@hive/shared';

interface CreateMessageInput {
  thread?: string;
  author: string;
  content: string;
  source?: string;
  created_by?: string;
}

export async function createMessage(pool: pg.Pool, space: string, input: CreateMessageInput): Promise<ChatMessage> {
  const table = chatTableName(space);
  const result = await pool.query(
    `INSERT INTO "${table}" (thread, author, content, source, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.thread || 'default', input.author, input.content, input.source || null, input.created_by || null]
  );
  return result.rows[0];
}

export async function listMessages(pool: pg.Pool, space: string, thread?: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
  const table = chatTableName(space);
  if (thread) {
    const result = await pool.query(
      `SELECT * FROM "${table}" WHERE thread = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [thread, limit, offset]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT * FROM "${table}" ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function deleteMessage(pool: pg.Pool, space: string, id: string): Promise<boolean> {
  const table = chatTableName(space);
  const result = await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listThreads(pool: pg.Pool, space: string): Promise<ThreadSummary[]> {
  const table = chatTableName(space);
  const result = await pool.query(
    `SELECT thread, COUNT(*)::int as message_count, MAX(created_at) as last_message_at
     FROM "${table}" GROUP BY thread ORDER BY last_message_at DESC`
  );
  return result.rows;
}

export async function deleteThread(pool: pg.Pool, space: string, thread: string): Promise<number> {
  const table = chatTableName(space);
  const result = await pool.query(`DELETE FROM "${table}" WHERE thread = $1`, [thread]);
  return result.rowCount ?? 0;
}

interface ChatSearchResult extends ChatMessage {
  headline: string;
  rank: number;
}

export async function searchMessages(pool: pg.Pool, space: string, query: string): Promise<ChatSearchResult[]> {
  const table = chatTableName(space);
  const result = await pool.query(
    `SELECT *,
       ts_headline('english', content, plainto_tsquery('english', $1)) as headline,
       ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank
     FROM "${table}"
     WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC
     LIMIT 50`,
    [query]
  );
  return result.rows;
}
