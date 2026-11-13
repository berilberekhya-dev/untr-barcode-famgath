import './env';
import { createDatabase } from '../src/lib/database';
import { dataTables } from '../src/lib/postgres-database';
import { GatheringService } from '../src/lib/service';
import type { SqlValue } from '../src/lib/storage';

// An explicit source prevents demo check-ins from being copied into the event accidentally.
async function main() {
  const sourceUrl = process.argv.find(a => a.startsWith('--source='))?.slice('--source='.length);
  const targetUrl = process.env.DATABASE_URL || '';
  if (!sourceUrl?.startsWith('file:') || !/^postgres(ql)?:/.test(targetUrl)) {
    throw new Error('Gunakan --source=file:data/event-v2.db dan DATABASE_URL PostgreSQL pada konfigurasi terpisah.');
  }
  const source = createDatabase(sourceUrl);
  const target = createDatabase(targetUrl);
  try {
    await source.ready(); await target.ready();
    const read = await source.client.transaction('read');
    const write = await target.client.transaction('write');
    try {
      const singletonTables = ['events', 'display_controls', 'projector_audio'];
      for (const table of dataTables.filter(t => !singletonTables.includes(t) && t !== 'app_migrations')) {
        const count = Number((await write.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);
        if (count) throw new Error('Database tujuan sudah berisi data acara. Migrasi dibatalkan tanpa menimpa data.');
      }
      const counts: Record<string, number> = {};
      for (const table of dataTables) {
        const rows = (await read.execute(`SELECT * FROM ${table}${table === 'prize_draws' ? ' ORDER BY created_at,rowid' : ''}`)).rows;
        for (const row of rows) {
          const columns = Object.keys(row);
          const query = `INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`;
          if (table === 'app_migrations') await write.execute({ sql: query + ' ON CONFLICT DO NOTHING', args: Object.values(row) as SqlValue[] });
          else if (singletonTables.includes(table)) {
            const fields = columns.filter(c => c !== 'id');
            await write.execute({ sql: `UPDATE ${table} SET ${fields.map(c => `${c}=?`).join(',')} WHERE id=1`, args: fields.map(c => row[c]) as SqlValue[] });
          } else await write.execute({ sql: query, args: Object.values(row) as SqlValue[] });
        }
        counts[table] = rows.length;
        const actual = Number((await write.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);
        if (table !== 'app_migrations' && actual !== rows.length) throw new Error(`Verifikasi jumlah tabel ${table} gagal.`);
        // Compare data too, not only row counts, before the destination transaction commits.
        if (table !== 'app_migrations') for (const row of rows) {
          const key = Object.keys(row)[0];
          const copied = (await write.execute({ sql: `SELECT * FROM ${table} WHERE ${key}=?`, args: [row[key] as SqlValue] })).rows[0];
          for (const field of Object.keys(row)) {
            if (String(copied?.[field] ?? '') !== String(row[field] ?? '')) throw new Error(`Verifikasi isi tabel ${table} gagal.`);
          }
        }
      }
      await read.commit(); await write.commit();
      console.log('Migrasi selesai; data sumber tetap utuh. Jumlah baris terverifikasi:', counts);
    } catch (error) { await read.rollback(); await write.rollback(); throw error; }
    finally { read.close(); write.close(); }
    const state = await new GatheringService(target).state('https://example.invalid/daftar');
    console.log({ roster: state.roster.length, checkins: state.stats.employees, eligible: state.stats.eligible, winners: state.stats.confirmed });
  } finally { await source.client.close(); await target.client.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Migrasi gagal.'); process.exitCode = 1; });
