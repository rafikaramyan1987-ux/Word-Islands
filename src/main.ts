import { timeScale } from './core/timescale';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/styles.css';
import { createPlatform } from './platform';
import { World } from './scene/world';
import { models } from './scene/models';
import { App } from './game/app';

async function boot() {
  const platform = await createPlatform();
  await platform.init().catch(() => undefined);
  platform.loadingStart();
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const world = new World(canvas);
  const app = new App(platform, world);
  await models.load().catch((e) => console.warn('models failed to load', e));
  await document.fonts?.ready.catch(() => undefined);
  app.start();
  platform.loadingDone();
  const bootEl = document.getElementById('boot');
  bootEl?.classList.add('hide');
  setTimeout(() => bootEl?.remove(), 500);
  // debug / test hooks (used by e2e tests and the preview capture script)
  (window as unknown as { __wi: unknown }).__wi = { app, world, timeScale };
}

void boot();
