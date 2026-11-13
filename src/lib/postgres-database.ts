import { Pool, type PoolClient } from 'pg';
import { sqliteMigration } from './database-migrations';
import type { Database, QueryResult, Statement, StorageTransaction } from './storage';
import { SUPABASE_ROOT_CA } from './supabase-ca';

export const POSTGRES_SCHEMA = 'ut_gathering';
const writeLock = '271420261114';
export const dataTables = [
  'events', 'registrations', 'draws', 'app_migrations', 'attendance_roster',
  'registration_details', 'coupon_transfers', 'prize_sessions', 'prize_requests',
  'prize_draws', 'display_controls', 'roster_seating', 'registration_seating', 'draw_only_roster',
  'prize_catalog', 'prize_session_catalog', 'projector_audio', 'projector_audio_levels',
] as const;

// Only placeholders outside SQL literals are converted; values stay parameterized.
export function postgresStatement(statement: Statement) {
  const sql = typeof statement === 'string' ? statement : statement.sql;
  let index = 0;
  return {
    text: sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, token => token === '?' ? `$${++index}` : token),
    values: typeof statement === 'string' ? [] : statement.args || [],
  };
}

export const postgresMigration = sqliteMigration.map(sql => {
  // Epoch milliseconds need BIGINT on PostgreSQL (SQLite INTEGER is already 64-bit).
  let result = sql.replace(/\b(created_at|reveal_at|received_at) INTEGER\b/g, '$1 BIGINT');
  if (result.startsWith('INSERT OR IGNORE INTO')) {
    result = result.replace('INSERT OR IGNORE INTO', 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
  }
  return result;
});

export function postgresTLS(hostname: string) {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return false;
  const supabase = hostname.endsWith('.pooler.supabase.com') || /^db\.[a-z0-9]+\.supabase\.co$/.test(hostname);
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n') || (supabase ? SUPABASE_ROOT_CA : undefined);
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

async function execute(client: PoolClient, statement: Statement): Promise<QueryResult> {
  const query = postgresStatement(statement);
  // No named prepared statements or pipelining: compatible with Supavisor transaction pooling.
  const result = await client.query(query.text, query.values);
  return { rows: result.rows };
}

export function createPostgresDatabase(connectionString: string): Database {
  const url = new URL(connectionString);
  // pg's URL sslmode option can overwrite the verified TLS configuration below.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new Pool({
    connectionString: url.toString(), max: 1, idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000, allowExitOnIdle: true,
    ssl: postgresTLS(url.hostname),
  });
  pool.on('error', error => console.error('PostgreSQL connection error:', (error as { code?: string }).code || 'connection failed'));

  async function transaction(mode: 'read' | 'write', migrate = false): Promise<StorageTransaction> {
    const client = await pool.connect();
    let finished = false;
    let released = false;
    try {
      await client.query(mode === 'read' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
      // Transaction-local settings survive transaction pooling without leaking to other clients.
      await client.query(`SET LOCAL search_path TO ${POSTGRES_SCHEMA}, pg_catalog`);
      await client.query("SET LOCAL statement_timeout TO '25s'");
      if (mode === 'write') {
        // Database-wide lock protects checks + writes across separate Vercel instances.
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [writeLock]);
      }
      if (migrate) await client.query(`CREATE SCHEMA IF NOT EXISTS ${POSTGRES_SCHEMA}`);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Release a broken connection below. */ }
      client.release(error instanceof Error ? error : true);
      throw error;
    }
    return {
      execute: statement => execute(client, statement),
      async batch(statements) {
        const results: QueryResult[] = [];
        for (const statement of statements) results.push(await execute(client, statement));
        return results;
      },
      async commit() { await client.query('COMMIT'); finished = true; },
      async rollback() { if (!finished) { await client.query('ROLLBACK'); finished = true; } },
      close() {
        if (released) return;
        released = true;
        // If a read fails before commit, discard rather than reuse an open transaction.
        client.release(!finished);
      },
    };
  }

  let initialization: Promise<void> | undefined;
  return {
    client: {
      transaction: mode => transaction(mode),
      async execute(statement) {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        const tx = await transaction(/^\s*SELECT\b/i.test(sql) ? 'read' : 'write');
        try { const result = await tx.execute(statement); await tx.commit(); return result; }
        catch (error) { await tx.rollback(); throw error; }
        finally { tx.close(); }
      },
      close: () => pool.end(),
    },
    // The cross-instance advisory transaction lock supplies serialization on PostgreSQL.
    serializeWrite: operation => operation(),
    ready() {
      initialization ??= (async () => {
        const tx = await transaction('write', true);
        try {
          await tx.batch(postgresMigration);
          await tx.execute(`REVOKE ALL ON SCHEMA ${POSTGRES_SCHEMA} FROM PUBLIC`);
          for (const table of dataTables) {
            await tx.execute(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
            await tx.execute(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`);
          }
          // No browser access through anon/authenticated even if a project has broad defaults.
          await tx.execute(`DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
              REVOKE ALL ON SCHEMA ${POSTGRES_SCHEMA} FROM anon;
              REVOKE ALL ON ALL TABLES IN SCHEMA ${POSTGRES_SCHEMA} FROM anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
              REVOKE ALL ON SCHEMA ${POSTGRES_SCHEMA} FROM authenticated;
              REVOKE ALL ON ALL TABLES IN SCHEMA ${POSTGRES_SCHEMA} FROM authenticated;
            END IF;
          END $$`);
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
        finally { tx.close(); }
      })().catch(error => { initialization = undefined; throw error; });
      return initialization;
    },
  };
}
