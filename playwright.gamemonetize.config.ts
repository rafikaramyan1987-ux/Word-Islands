import { defineConfig } from '@playwright/test';

/** smoke test of the gamemonetize build (dist-gamemonetize/, `npm run build:gamemonetize`) with a stubbed SDK */
export default defineConfig({
  testDir: 'e2e-portals',
  testMatch: 'gamemonetize.spec.ts',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort --outDir dist-gamemonetize',
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
});
