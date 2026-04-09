import pg from 'pg';
import { getSpaceConfig } from '../config/manager.js';

const pools = new Map<string, pg.Pool>();

function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool(space: string): pg.Pool {
  let pool = pools.get(space);
  if (pool) return pool;

  const config = getSpaceConfig(space);
  if (!config) {
    throw new Error(`No config found for space "${space}"`);
  }

  if (!config.database_url) {
    throw new Error(`No database_url configured for space "${space}"`);
  }
  pool = createPool(config.database_url);
  pools.set(space, pool);
  return pool;
}

export async function removePool(space: string): Promise<void> {
  const pool = pools.get(space);
  if (pool) {
    await pool.end();
    pools.delete(space);
  }
}

export async function testConnection(databaseUrl: string): Promise<string | null> {
  const pool = createPool(databaseUrl);
  try {
    await pool.query('SELECT 1');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Unknown error';
  } finally {
    await pool.end();
  }
}
