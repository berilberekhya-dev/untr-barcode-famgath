import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages: ['@libsql/client', 'pg'] };
export default config;
