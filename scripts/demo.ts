import './env';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createDatabase } from '../src/lib/database';
import { GatheringService } from '../src/lib/service';
import { demoRoster } from './demo-roster';

async function main() {
  const url = 'file:data/demo-synthetic-v1.db';
  const database = createDatabase(url);
  const service = new GatheringService(database);
  await service.importRoster(demoRoster);
  await service.setDemo(); await database.client.close();
  console.log('Demo sintetis siap: data/demo-synthetic-v1.db. Data acara tidak dipakai; check-in tidak dibuat otomatis.');
  if (process.argv.includes('--start')) {
    const base = new URL(process.env.APP_BASE_URL || 'http://localhost:3000'); base.port = '3001';
    const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', '3001'], {
      stdio: 'inherit', windowsHide: true, env: { ...process.env, DATABASE_URL: url, DATABASE_AUTH_TOKEN: '', APP_BASE_URL: base.origin },
    });
    child.on('exit', code => process.exit(code || 0));
    process.on('SIGTERM', () => child.kill()); process.on('SIGINT', () => child.kill());
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });
