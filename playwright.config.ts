import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium' },
  webServer: {
    command:
      'cross-env MARKET_MODE=demo VITE_PROFILE_RENDER=1 PORT=3002 DATA_FILE=.data/e2e-stocks.json concurrently -k "tsx server/index.ts" "vite --host 127.0.0.1 --port 5174"',
    url: 'http://127.0.0.1:5174/api/state',
    reuseExistingServer: false,
  },
})
