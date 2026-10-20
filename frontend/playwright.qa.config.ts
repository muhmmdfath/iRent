import { defineConfig } from '@playwright/test';
if (!process.env.IRENT_QA_CONTROL)
  throw new Error(
    'Start scripts/start-rental-qa.cjs and set IRENT_QA_CONTROL to its private control file.',
  );
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'rental-lifecycle-real.spec.ts',
    'rental-edge-cases-real.spec.ts',
  ],
  // Both scenarios share a test-only clock; do not run them concurrently.
  workers: 1,
  outputDir: 'test-results/rental-qa',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/rental-qa-results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5181',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181',
    env: { IRENT_API_PROXY_TARGET: 'http://127.0.0.1:3031' },
    reuseExistingServer: !process.env.CI,
  },
});
