import { defineConfig } from '@playwright/test';

/** smoke test of the y8 build (dist-y8/, `npm run build:y8`) with a stubbed SDK */
export default defineConfig({
  testDir: 'e2e-portals',
  testMatch: 'y8.spec.ts',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
    baseURL: 'http://localhost:4175',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx vite preview --port 4175 --strictPort --outDir dist-y8',
    port: 4175,
    reuseExistingServer: !process.env.CI,
  },
});
