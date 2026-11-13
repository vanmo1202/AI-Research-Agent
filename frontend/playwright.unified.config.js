import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'unified-chat.spec.js',
  workers: 1,
  timeout: 20000,
  use: {
    baseURL: 'http://127.0.0.1:4176',
    channel: process.env.PLAYWRIGHT_CHROME_PATH ? undefined : 'chrome',
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROME_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
        : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 4176 --host 127.0.0.1',
    url: 'http://127.0.0.1:4176',
    env: { VITE_API_BASE_URL: '' },
  },
});
