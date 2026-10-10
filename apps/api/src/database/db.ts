import { Pool } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000
  });
  pool.on('error', (err) => logger.error({ err }, 'pg pool error'));
  return pool;
}

export async function dbAvailable(): Promise<boolean> {
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Test hook. */
export async function _closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
