import './env';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDatabase } from '../src/lib/database';
import { GatheringService } from '../src/lib/service';
import type { AdminState } from '../src/lib/types';
import { dataTables } from '../src/lib/postgres-database';

function snapshot(state: AdminState) {
  return JSON.stringify({
    event: state.event, stats: state.stats, showWinners: state.showWinners,
    roster: [...state.roster].sort((a, b) => a.nrp.localeCompare(b.nrp)),
    registrations: [...state.registrations].sort((a, b) => a.id.localeCompare(b.id)),
    sessions: [...state.sessions].sort((a, b) => a.id.localeCompare(b.id)),
    draws: [...state.draws].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!/^postgres(ql)?:/.test(url)) throw new Error('DATABASE_URL PostgreSQL diperlukan.');
  const local = createDatabase('file:data/event-v2.db');
  const cloud = createDatabase(url);
  const endpoint = 'https://example.invalid/daftar';
  try {
    const source = await new GatheringService(local).state(endpoint);
    const service = new GatheringService(cloud);
    const target = await service.state(endpoint);
    if (snapshot(source) !== snapshot(target)) throw new Error('Data Supabase belum cocok dengan snapshot acara lokal.');
    const security = (await cloud.client.execute(`SELECT
      COUNT(*) tables, COUNT(*) FILTER(WHERE c.relrowsecurity) protected
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='ut_gathering' AND c.relkind='r'`)).rows[0];
    if (Number(security.tables) !== dataTables.length || Number(security.protected) !== dataTables.length) throw new Error('Pemeriksaan RLS gagal.');
    for (const role of ['anon', 'authenticated']) {
      const permissions = (await cloud.client.execute({
        sql: "SELECT has_schema_privilege(?,'ut_gathering','USAGE') schema_access, has_table_privilege(?,'ut_gathering.attendance_roster','SELECT') roster_access",
        args: [role, role],
      })).rows[0];
      if (permissions.schema_access || permissions.roster_access) throw new Error('Akses browser ke data privat harus ditolak.');
    }
    const display = JSON.stringify(await service.display(endpoint));
    for (const field of ['"nrp"', 'rosterId', 'requestKey', 'plannedSize']) if (display.includes(field)) throw new Error('Data privat terdeteksi pada tampilan publik.');
    const manifestPath = 'data/supabase-migration.json';
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { sourceDatabase: 'data/event-v2.db' };
    manifest.migrated = true; manifest.verifiedAt = new Date().toISOString();
    manifest.snapshotSHA256 = createHash('sha256').update(snapshot(target)).digest('hex');
    manifest.security = { tables: Number(security.tables), rls: Number(security.protected), browserAccess: false, publicDisplayPrivateData: false };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log({ verified: true, roster: target.roster.length, tablesAssigned: target.roster.filter(r => r.tableNumber).length, eligible: target.stats.eligible,
      uts: target.roster.filter(r => r.source === 'uts').length, checkins: target.stats.employees, winners: target.stats.confirmed, protectedTables: Number(security.protected) });
  } finally { await local.client.close(); await cloud.client.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Verifikasi gagal.'); process.exitCode = 1; });
