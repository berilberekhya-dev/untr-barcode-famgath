import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, fullyParallel: false, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx tsx scripts/e2e-server.ts', url: 'http://127.0.0.1:3100/api/display', reuseExistingServer: false, timeout: 60000 },
  reporter: [['list']],
});
