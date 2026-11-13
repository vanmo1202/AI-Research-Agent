import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ['rebuild.spec.js', 'reference.spec.js'],
  timeout: 20000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROME_PATH ? undefined : 'chrome',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROME_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
        : {}),
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4175 --host 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
});
