import { defineConfig } from '@playwright/test';

// Port và database riêng để test không ảnh hưởng backend/n8n đang chạy.
export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 1080 },
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
    channel: process.env.PLAYWRIGHT_CHROME_PATH ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/start-backend.cjs',
      url: 'http://localhost:4300/health',
      env: {
        PORT: '4300',
        MOCK_LLM: 'true',
        MOCK_SEARCH: 'true',
        FRONTEND_ORIGIN: 'http://localhost:4173',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 4173 --host 127.0.0.1',
      url: 'http://localhost:4173',
      env: { VITE_API_BASE_URL: 'http://localhost:4300' },
      reuseExistingServer: false,
    },
  ],
});
