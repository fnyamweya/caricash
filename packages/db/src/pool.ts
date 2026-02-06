import { Pool } from 'pg';
import { PoolConfig } from './types';

let pool: Pool | null = null;

export function createPool(config: PoolConfig): Pool {
  if (pool) {
    return pool;
  }
  pool = new Pool({
    connectionString: config.connectionString,
    min: config.min ?? 2,
    max: config.max ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
    statement_timeout: config.statement_timeout ?? 30000,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message);
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('[db] Pool not initialized. Call createPool() first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
