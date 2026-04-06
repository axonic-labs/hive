import type pg from 'pg';

const SPACE_NAME_RE = /^[a-z][a-z0-9_]{0,49}$/;

export function validateSpaceName(name: string): boolean {
  return SPACE_NAME_RE.test(name);
}

export function tableName(space: string): string {
  if (!validateSpaceName(space)) throw new Error(`Invalid space name: ${space}`);
  return `hive_${space}`;
}

export async function createSpaceTable(pool: pg.Pool, space: string): Promise<void> {
  const table = tableName(space);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${table}" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path TEXT NOT NULL DEFAULT '',
      filename TEXT NOT NULL,
      content_text TEXT,
      content_blob BYTEA,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(path, filename)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "idx_${space}_path" ON "${table}" (path)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "idx_${space}_fulltext" ON "${table}" USING gin(to_tsvector('english', coalesce(content_text, '')))`);
}

export async function dropSpaceTable(pool: pg.Pool, space: string): Promise<void> {
  const table = tableName(space);
  await pool.query(`DROP TABLE IF EXISTS "${table}"`);
}
