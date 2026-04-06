import crypto from 'node:crypto';
import type pg from 'pg';
import { tableName } from './spaces.js';
import type { FileEntry, FileListEntry } from '@hive/shared';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function parseFilePath(wildcardPath: string): { path: string; filename: string } {
  const parts = wildcardPath.split('/');
  const filename = parts.pop()!;
  const filePath = parts.join('/');
  return { path: filePath, filename };
}

function buildPermissionFilter(prefixes: string[] | '*', paramOffset: number): { clause: string; params: string[] } {
  if (prefixes === '*') return { clause: '', params: [] };
  if (prefixes.length === 0) return { clause: 'AND FALSE', params: [] };

  const conditions = prefixes.map((_, i) => {
    const p = paramOffset + i;
    return `(path = $${p} OR path LIKE $${p} || '/%' OR (path || '/' || filename) LIKE $${p} || '%')`;
  });
  return {
    clause: `AND (${conditions.join(' OR ')})`,
    params: prefixes.map(p => p.replace(/\/$/, '')),
  };
}

export async function listFiles(pool: pg.Pool, space: string, prefix?: string, permittedPrefixes?: string[] | '*'): Promise<FileListEntry[]> {
  const table = tableName(space);
  const params: string[] = [];
  let where = '';

  if (prefix) {
    const cleanPrefix = prefix.replace(/\/$/, '');
    params.push(cleanPrefix);
    where = `WHERE (path = $1 OR path LIKE $1 || '/%')`;
  }

  const permFilter = buildPermissionFilter(permittedPrefixes ?? '*', params.length + 1);
  params.push(...permFilter.params);

  const result = await pool.query(
    `SELECT id, path, filename, created_at, updated_at FROM "${table}" ${where ? where : 'WHERE TRUE'} ${permFilter.clause} ORDER BY path, filename`,
    params
  );
  return result.rows;
}

export async function readFile(pool: pg.Pool, space: string, filePath: string, filename: string): Promise<FileEntry | null> {
  const table = tableName(space);
  const result = await pool.query(
    `SELECT * FROM "${table}" WHERE path = $1 AND filename = $2`,
    [filePath, filename]
  );
  return result.rows[0] ?? null;
}

async function ensureFolders(pool: pg.Pool, space: string, filePath: string): Promise<void> {
  if (!filePath) return;
  const table = tableName(space);
  const parts = filePath.split('/');
  for (let i = 0; i < parts.length; i++) {
    const folderFullPath = parts.slice(0, i + 1).join('/');
    await pool.query(
      `INSERT INTO "${table}" (path, filename) VALUES ($1, '.keep') ON CONFLICT (path, filename) DO NOTHING`,
      [folderFullPath]
    );
  }
}

export async function createFile(pool: pg.Pool, space: string, filePath: string, filename: string, content: string): Promise<FileEntry> {
  const table = tableName(space);
  await ensureFolders(pool, space, filePath);
  const hash = sha256(content);
  const result = await pool.query(
    `INSERT INTO "${table}" (path, filename, content_text, content_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
    [filePath, filename, content, hash]
  );
  return result.rows[0];
}

export async function writeFile(pool: pg.Pool, space: string, filePath: string, filename: string, content: string): Promise<FileEntry> {
  const table = tableName(space);
  await ensureFolders(pool, space, filePath);
  const hash = sha256(content);
  const result = await pool.query(
    `INSERT INTO "${table}" (path, filename, content_text, content_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (path, filename) DO UPDATE SET content_text = $3, content_hash = $4, updated_at = now()
     RETURNING *`,
    [filePath, filename, content, hash]
  );
  return result.rows[0];
}

export async function appendFile(pool: pg.Pool, space: string, filePath: string, filename: string, content: string): Promise<FileEntry> {
  const table = tableName(space);
  await ensureFolders(pool, space, filePath);

  // Try update first
  const existing = await pool.query(
    `SELECT id FROM "${table}" WHERE path = $1 AND filename = $2`,
    [filePath, filename]
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE "${table}" SET content_text = coalesce(content_text, '') || E'\\n' || $3,
       updated_at = now()
       WHERE path = $1 AND filename = $2 RETURNING *`,
      [filePath, filename, content]
    );
    const row = result.rows[0];
    row.content_hash = sha256(row.content_text);
    await pool.query(`UPDATE "${table}" SET content_hash = $1 WHERE id = $2`, [row.content_hash, row.id]);
    return row;
  }

  return createFile(pool, space, filePath, filename, content);
}

export async function deleteFile(pool: pg.Pool, space: string, filePath: string, filename: string): Promise<boolean> {
  const table = tableName(space);
  const result = await pool.query(
    `DELETE FROM "${table}" WHERE path = $1 AND filename = $2`,
    [filePath, filename]
  );
  return (result.rowCount ?? 0) > 0;
}
