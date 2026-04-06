import pg from 'pg';
import { getSpaceConfig } from '../config/manager.js';

const pools = new Map<string, pg.Pool>();

export function getPool(space: string): pg.Pool {
  let pool = pools.get(space);
  if (pool) return pool;

  const config = getSpaceConfig(space);
  if (!config) {
    throw new Error(`No config found for space "${space}"`);
  }

  pool = new pg.Pool({ connectionString: config.database_url });
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

export async function testConnection(databaseUrl: string): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}
