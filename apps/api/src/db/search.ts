import type pg from 'pg';
import { tableName } from './spaces.js';
import type { FileListEntry } from '@hive/shared';

interface SearchResult extends FileListEntry {
  headline: string;
  rank: number;
}

export async function searchFiles(
  pool: pg.Pool,
  space: string,
  query: string,
  permittedPrefixes: string[] | '*'
): Promise<SearchResult[]> {
  const table = tableName(space);
  const params: (string)[] = [query];
  let permClause = '';

  if (permittedPrefixes !== '*' && permittedPrefixes.length === 0) {
    return [];
  }

  if (permittedPrefixes !== '*') {
    const conditions = permittedPrefixes.map((_, i) => {
      const p = i + 2;
      return `(path = $${p} OR path LIKE $${p} || '/%')`;
    });
    permClause = `AND (${conditions.join(' OR ')})`;
    params.push(...permittedPrefixes.map(p => p.replace(/\/$/, '')));
  }

  const result = await pool.query(
    `SELECT id, path, filename, created_at, updated_at,
       ts_headline('english', coalesce(content_text, ''), plainto_tsquery('english', $1)) as headline,
       ts_rank(to_tsvector('english', coalesce(content_text, '')), plainto_tsquery('english', $1)) as rank
     FROM "${table}"
     WHERE to_tsvector('english', coalesce(content_text, '')) @@ plainto_tsquery('english', $1)
       AND filename != '.keep'
       ${permClause}
     ORDER BY rank DESC
     LIMIT 50`,
    params
  );
  return result.rows;
}
