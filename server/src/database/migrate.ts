import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './db.js';
import { logger } from '../config/logger.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const files = readdirSync(here + '/migrations').filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    // 002 requires pgvector; attempt but tolerate missing extension with a clear log.
    if (file === '002_pgvector.sql') {
      const { rows } = await pool.query(`SELECT 1 FROM pg_available_extensions WHERE name='vector'`);
      if (rows.length === 0) {
        logger.warn('pgvector extension not available — skipping 002_pgvector.sql (JSONB fallback remains active)');
        continue;
      }
    }
    const done = await pool.query(`SELECT 1 FROM schema_migrations WHERE name=$1`, [file]);
    if (done.rowCount && done.rowCount > 0) continue;
    const sql = readFileSync(join(here, 'migrations', file), 'utf-8');
    try {
      await pool.query(sql);
    } catch (err) {
      // 002 may fail if server lacks the extension even though available locally.
      if (file === '002_pgvector.sql') {
        logger.warn({ err }, '002_pgvector.sql failed — continuing with JSONB fallback');
        continue;
      }
      throw err;
    }
    await pool.query(`INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING`, [file]);
    logger.info(`migration applied: ${file}`);
  }
}

if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
