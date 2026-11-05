import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

async function main() {
  const password = randomBytes(24).toString('hex');
  const cluster = new EmbeddedPostgres({
    databaseDir: resolve(`data/postgres-tests-${Date.now()}`),
    user: 'postgres', password, port: 55432, persistent: true,
    initdbFlags: ['--locale=C', '--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {}, onError: message => console.error(String(message)),
  });
  try {
    await cluster.initialise(); await cluster.start();
    console.log('PostgreSQL sementara aktif di loopback, khusus database tes sintetis.');
    const e2e = process.argv.includes('--e2e');
    const child = spawn(process.execPath, [resolve(e2e ? 'node_modules/@playwright/test/cli.js' : 'node_modules/vitest/vitest.mjs'), e2e ? 'test' : 'run'], {
      stdio: 'inherit', windowsHide: true,
      env: { ...process.env, UT_TEST_POSTGRES_URL: `postgresql://postgres:${password}@127.0.0.1:55432/postgres` },
    });
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
  } finally { await cluster.stop(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Tes PostgreSQL gagal.'); process.exitCode = 1; });
