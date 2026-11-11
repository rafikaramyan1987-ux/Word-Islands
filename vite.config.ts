import { readFileSync } from 'node:fs';
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

/**
 * Playgama build only, as Playgama's docs set it up for plain JS (wiki.playgama.com/playgama/bridge-sdk/setup) and as
 * in Mahjong Jade Garden / Fix It Garage:
 * - the official Bridge from Playgama's CDN as the first script in <head>, loaded normally (it carries every platform
 *   adapter, so Playgama's checker with ?platform_id=qa_tool gets its initialize handshake);
 * - right after it, tools/playgama/boot.js inlined: `bridge.initialize()`, and the game bundle starts only once that
 *   has settled (the module scripts are held as <script type="text/plain" data-playgama-game> until then);
 * - `playgama-bridge-config.json` beside index.html with Playgama's defaults (an empty object: Bridge alone paces
 *   interstitials).
 */
export const PLAYGAMA_BRIDGE_CDN = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
const playgamaBoot = () => readFileSync('tools/playgama/boot.js', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').trim();
function playgamaBridge(): Plugin {
  return {
    name: 'playgama-bridge',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: () =>
        platform === 'playgama'
          ? [
              { tag: 'script', attrs: { src: PLAYGAMA_BRIDGE_CDN }, injectTo: 'head-prepend' },
              { tag: 'script', children: playgamaBoot(), injectTo: 'head-prepend' },
            ]
          : [],
    },
    generateBundle: {
      order: 'post',
      handler(_o, bundle) {
        if (platform !== 'playgama') return;
        this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: readFileSync('tools/playgama/playgama-bridge-config.json') });
        const html = Object.values(bundle).find((a) => a.type === 'asset' && a.fileName.endsWith('.html'));
        if (!html || html.type !== 'asset' || typeof html.source !== 'string') return;
        let held = 0;
        html.source = html.source
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          .replace(/<script type="module"([^>]*)><\/script>/g, (_m, attrs: string) => {
            held++;
            const src = attrs.match(/\ssrc="([^"]+)"/)?.[1];
            return `<script type="text/plain" data-playgama-game${src ? ` data-src="${src}"` : ''}></script>`;
          });
        if (!held) throw new Error('playgama build: no game module script to hold until bridge.initialize()');
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [gamepixHtml(), playgamaBridge()],
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
