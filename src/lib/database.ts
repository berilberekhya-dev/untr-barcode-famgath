import { createClient } from '@libsql/client/node';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sqliteMigration } from './database-migrations';
import { createPostgresDatabase } from './postgres-database';
import type { Database } from './storage';
export type { Database } from './storage';


export async function retryBusy<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 7 || !['SQLITE_BUSY', 'SQLITE_LOCKED', 'TRANSACTION_ACTIVE'].includes(code || '')) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(30 * 2 ** attempt, 500) + Math.random() * 70));
    }
  }
}

export function createDatabase(url: string, authToken?: string): Database {
  if (/^postgres(ql)?:/.test(url)) return createPostgresDatabase(url);
  if (url.startsWith('file:') && !url.includes(':memory:')) {
    const path = url.slice(5);
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  const client = createClient({ url, authToken });
  let initialization: Promise<void> | undefined;
  let writeTail: Promise<unknown> = Promise.resolve();
  return {
    client,
    serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
      const result = writeTail.then(operation, operation);
      writeTail = result.catch(() => undefined);
      return result;
    },
    ready() {
      initialization ??= retryBusy(async () => {
        if (url.startsWith('file:')) await client.execute('PRAGMA journal_mode=WAL');
        await client.batch(sqliteMigration, 'write');
      }).catch(error => {
        initialization = undefined;
        throw error;
      });
      return initialization;
    },
  };
}

const globalDb = globalThis as unknown as { gatheringDb?: Database };
export function getDatabase() {
  if (!globalDb.gatheringDb) {
    const url = process.env.DATABASE_URL || (process.env.VERCEL ? '' : 'file:data/event-v2.db');
    if (!url || (process.env.VERCEL && url.startsWith('file:'))) {
      throw new Error('Konfigurasi DATABASE_URL Supabase/PostgreSQL diperlukan untuk Vercel.');
    }
    globalDb.gatheringDb = createDatabase(url, process.env.DATABASE_AUTH_TOKEN || undefined);
  }
  return globalDb.gatheringDb;
}
