import * as fs from 'fs';
import * as path from 'path';
import { getPool } from './pool';
import { createPool } from './pool';

const MIGRATIONS_TABLE = 'schema_migrations';

interface MigrationRecord {
  version: string;
  applied_at: Date;
}

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query<MigrationRecord>(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`
  );
  return new Set(result.rows.map((r) => r.version));
}

function getMigrationFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
}

export async function runMigrations(migrationsDir?: string): Promise<string[]> {
  const dir = migrationsDir ?? path.resolve(process.cwd(), 'migrations');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles(dir);
  const pool = getPool();
  const newlyApplied: string[] = [];

  for (const file of files) {
    const version = file.replace('.up.sql', '');
    if (applied.has(version)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
        [version],
      );
      await client.query('COMMIT');
      console.log(`[migrate] Applied: ${version}`);
      newlyApplied.push(version);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[migrate] Failed: ${version}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  if (newlyApplied.length === 0) {
    console.log('[migrate] No new migrations to apply.');
  }

  return newlyApplied;
}

// CLI entry point
if (require.main === module) {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://caricash:caricash_dev@localhost:5432/caricash';
  createPool({ connectionString });

  const migrationsDir = process.argv[2] || path.resolve(__dirname, '../../..', 'migrations');

  runMigrations(migrationsDir)
    .then((applied) => {
      console.log(`[migrate] Done. Applied ${applied.length} migration(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] Migration failed:', err);
      process.exit(1);
    });
}
