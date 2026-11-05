import { existsSync } from 'node:fs';
const explicit = process.env.UT_ENV_FILE;
if (explicit && !existsSync(explicit)) throw new Error('File konfigurasi UT_ENV_FILE tidak ditemukan.');
for (const file of explicit ? [explicit] : ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
