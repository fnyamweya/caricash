import { Pool, PoolClient, QueryResultRow } from 'pg';
import { getPool } from './pool';
import { IsolationLevel, TransactionClient } from './types';

/**
 * Execute a parameterized query against the pool or a transaction client.
 * All queries MUST use parameterized values - no string interpolation.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
  client?: PoolClient,
): Promise<{ rows: T[]; rowCount: number | null }> {
  const executor = client ?? getPool();
  const result = await executor.query<T>(text, values);
  return { rows: result.rows, rowCount: result.rowCount };
}

/**
 * Execute a query and return exactly one row, or null.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
  client?: PoolClient,
): Promise<T | null> {
  const result = await query<T>(text, values, client);
  return result.rows[0] ?? null;
}

/**
 * Execute a query and return all rows.
 */
export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
  client?: PoolClient,
): Promise<T[]> {
  const result = await query<T>(text, values, client);
  return result.rows;
}

/**
 * Execute a function within a database transaction.
 * Supports configurable isolation levels (default: READ COMMITTED).
 * Automatically commits on success or rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>,
  options?: { isolationLevel?: IsolationLevel },
): Promise<T> {
  const pool: Pool = getPool();
  const client = await pool.connect();
  const isolation = options?.isolationLevel ?? 'READ COMMITTED';

  try {
    await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolation}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Acquire a PostgreSQL advisory lock within a transaction.
 * Useful for serializing concurrent operations on the same resource.
 */
export async function withAdvisoryLock(
  client: TransactionClient,
  lockId: bigint,
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);
}
