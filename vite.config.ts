import { defineConfig, type Plugin } from 'vite';

const PLATFORMS = ['web', 'crazygames', 'gd', 'gamepix', 'playgama'] as const;
const platform = process.env.VITE_PLATFORM ?? 'web';
if (!(PLATFORMS as readonly string[]).includes(platform)) {
  throw new Error(`VITE_PLATFORM must be one of ${PLATFORMS.join(', ')} (got "${platform}")`);
}

/** GamePix SDK v3: loaded by index.html before the game bundle, with the manual lifecycle. */
const GPX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';

/** GamePix build only: `window.GamePixConfig = { lifecycle: 'manual' }`, then the SDK script, before the bundle. */
function gamepixHtml(): Plugin {
  return {
    name: 'gamepix-html',
    transformIndexHtml: {
      order: 'post',
      handler: () =>
        platform === 'gamepix'
          ? [
              { tag: 'script', children: "window.GamePixConfig = { lifecycle: 'manual' };", injectTo: 'head-prepend' },
              { tag: 'script', attrs: { src: GPX_SDK_URL }, injectTo: 'head-prepend' },
            ]
          : [],
    },
  };
}

/** Extra files some portals need next to index.html. */
function platformFiles(): Plugin {
  return {
    name: 'platform-files',
    generateBundle() {
      if (platform === 'playgama') {
        this.emitFile({
          type: 'asset',
          fileName: 'playgama-bridge-config.json',
          source: JSON.stringify({ advertisement: { minimumDelayBetweenInterstitial: 120 } }, null, 2) + '\n',
        });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [platformFiles(), gamepixHtml()],
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
