import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) {
  console.log('.env.local sudah ada. Konfigurasi Anda tetap dipakai.');
} else {
  const text = [
    '# Local testing only. Set different credentials on Vercel.',
    'APP_BASE_URL=http://localhost:3000',
    'DATABASE_URL=file:data/event-v2.db',
    'DATABASE_AUTH_TOKEN=',
    `ADMIN_PASSWORD=UT-Orbit-${randomBytes(6).toString('hex')}`,
    `SESSION_SECRET=${randomBytes(32).toString('hex')}`, '',
  ].join('\n');
  writeFileSync('.env.local', text, { flag: 'wx' });
  console.log('Konfigurasi lokal dibuat. Password panitia ada di .env.local (ADMIN_PASSWORD).');
}
