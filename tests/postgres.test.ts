import { it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createDatabase } from '../src/lib/database';
import { GatheringService } from '../src/lib/service';
import { postgresStatement, postgresTLS, dataTables } from '../src/lib/postgres-database';

it('PostgreSQL tetap memakai parameter tanpa mengganti tanda tanya di literal SQL', () => {
  expect(postgresStatement({ sql: `SELECT '?' AS "?", 'it''s ?' AS label WHERE nrp=? AND name=?`, args: ['00001', "O'Brian"] }))
    .toEqual({ text: `SELECT '?' AS "?", 'it''s ?' AS label WHERE nrp=$1 AND name=$2`, values: ['00001', "O'Brian"] });
});

it('TLS Supabase memverifikasi CA resmi dan hostname, tetap menolak sertifikat tidak dipercaya', () => {
  const config = postgresTLS('aws-0-ap-southeast-1.pooler.supabase.com');
  expect(config).toMatchObject({ rejectUnauthorized: true });
  if (!config || !config.ca) throw new Error('CA resmi diperlukan.');
  const cert = new X509Certificate(config.ca);
  expect(cert.fingerprint256.replaceAll(':', '').toLowerCase()).toBe('807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa');
  expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());
  expect(postgresTLS('another-provider.example')).toEqual({ rejectUnauthorized: true });
  expect(postgresTLS('127.0.0.1')).toBe(false);
});

async function isolatedPostgres() {
  const url = new URL(process.env.UT_TEST_POSTGRES_URL!);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432') throw new Error('Cluster tes harus lokal.');
  const admin = new Pool({ connectionString: url.toString() });
  const name = `ut_test_${randomUUID().replaceAll('-', '')}`;
  try { await admin.query(`CREATE DATABASE ${name}`); } finally { await admin.end(); }
  url.pathname = `/${name}`;
  return url.toString();
}

it.runIf(Boolean(process.env.UT_TEST_POSTGRES_URL))('schema privat, RLS dan grant menolak akses browser ke seluruh tabel', async () => {
  const url = await isolatedPostgres();
  const admin = new Pool({ connectionString: url });
  const db = createDatabase(url);
  try {
    await admin.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$`);
    await db.ready();
    const security = await admin.query("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ut_gathering' AND c.relkind='r'");
    expect(security.rows).toHaveLength(dataTables.length);
    expect(security.rows.every(r => r.relrowsecurity)).toBe(true);
    for (const role of ['anon', 'authenticated']) {
      expect((await admin.query("SELECT has_schema_privilege($1,'ut_gathering','USAGE') allowed", [role])).rows[0].allowed).toBe(false);
      const client = await admin.connect();
      try {
        await client.query('BEGIN'); await client.query(`SET LOCAL ROLE ${role}`);
        await expect(client.query('SELECT * FROM ut_gathering.attendance_roster')).rejects.toMatchObject({ code: '42501' });
      } finally { await client.query('ROLLBACK'); client.release(); }
    }
  } finally { await db.client.close(); await admin.end(); }
});

it.runIf(Boolean(process.env.UT_TEST_POSTGRES_URL))('transfer SQLite mempertahankan tiket, kupon, sesi undian, lalu menolak menimpa database berisi', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'ut-transfer-'));
  const sourceUrl = `file:${join(folder, 'source.db').replaceAll('\\', '/')}`;
  const source = createDatabase(sourceUrl);
  const targetUrl = await isolatedPostgres(); const target = createDatabase(targetUrl);
  const envFile = join(folder, '.env'); writeFileSync(envFile, '');
  const run = () => promisify(execFile)(process.execPath, ['--import', 'tsx', resolve('scripts/migrate-sqlite-to-postgres.ts'), `--source=${sourceUrl}`], {
    env: { ...process.env, UT_ENV_FILE: envFile, DATABASE_URL: targetUrl, DATABASE_AUTH_TOKEN: '' }, windowsHide: true,
  });
  try {
    const original = new GatheringService(source);
    await original.importRoster(Array.from({ length: 6 }, (_, i) => ({ nrp: `0000${i}`, fullName: `Peserta ${i}`, company: 'UT', plannedSize: 3, source: 'excel', drawEnabled: true, tableNumber: '18' })));
    const donor = await original.register({ nrp: '00000', fullName: 'X', partySize: 1, requestKey: randomUUID() });
    const recipient = await original.register({ nrp: '00001', fullName: 'X', partySize: 5, acknowledgedExtra: true, requestKey: randomUUID() });
    await original.transferCoupons({ donorId: donor.id, recipientId: recipient.id, quantity: 2, requestKey: randomUUID() });
    await original.draw({ requestKey: randomUUID(), count: 3, prizeName: 'Sepeda' });
    await run();
    const before = await original.state('https://test.invalid/daftar');
    const copied = await new GatheringService(target).state('https://test.invalid/daftar');
    for (const field of ['event', 'registrations', 'roster', 'draws', 'sessions', 'stats'] as const) expect(copied[field]).toEqual(before[field]);
    await expect(run()).rejects.toMatchObject({ code: 1 });
    expect((await new GatheringService(target).state('https://test.invalid/daftar')).stats).toEqual(copied.stats);
  } finally { await source.client.close(); await target.client.close(); }
});
