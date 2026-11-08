import { defineConfig, devices } from '@playwright/test'

// Smoke tests (e2e/): a real browser against the real staging API. See README, Smoke tests.
// By default Playwright starts the dev server on 5173, which
// proxies the API with the key from .env. Set BASE_URL to test a deployed site instead.
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0, // a smoke test that only passes on retry is worth knowing about
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      // The installed Google Chrome: Playwright no longer ships its own Chromium for macOS 13.
      use: { ...devices['Pixel 9'], channel: 'chrome' },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
      },
})
