import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';
const eventAudio = ['champions-anthem.mp3', 'drum-roll.mp3', 'brass-reveal-636-900.mp3']
  .every(file => existsSync(join(process.cwd(), 'public/audio/event', file)));
const config: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'pg'],
  env: { NEXT_PUBLIC_EVENT_AUDIO: String(eventAudio) },
};
export default config;
