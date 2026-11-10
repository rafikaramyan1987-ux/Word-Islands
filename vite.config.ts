import { defineConfig } from 'vite';

const PLATFORMS = ['web', 'crazygames', 'gd', 'gamepix', 'playgama'] as const;
const platform = process.env.VITE_PLATFORM ?? 'web';
if (!(PLATFORMS as readonly string[]).includes(platform)) {
  throw new Error(`VITE_PLATFORM must be one of ${PLATFORMS.join(', ')} (got "${platform}")`);
}

export default defineConfig({
  base: './',
  define: {
    __PLATFORM__: JSON.stringify(platform),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    reportCompressedSize: false,
  },
  server: { host: true },
});
