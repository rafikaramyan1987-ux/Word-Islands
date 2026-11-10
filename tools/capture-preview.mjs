#!/usr/bin/env node
/**
 * Captures the Phase A preview media into docs/preview/:
 * 8 screenshots (desktop 1920x1080 and phone 390x844) and a ~30 s gameplay video at 390x844.
 * Usage: npm run build:web && npx vite preview --outDir dist/web --port 4173 & npm run preview:capture
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const URL = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
const OUT = path.resolve('docs/preview');
fs.mkdirSync(OUT, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const KEY = 'word-islands.save.v1';

const save = (lang, level, extra = {}) => ({
  version: 1, lang, music: true, sound: true, coins: 120, tutorialDone: level > 0 || extra.tutorialDone === true,
  progress: { [lang]: { level, found: extra.found ?? [], bonus: [], revealed: [], freeHintUsed: false } },
});

async function page(browser, w, h, s, dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    if (v) localStorage.setItem(k, v);
  }, [KEY, s ? JSON.stringify(s) : null]);
  await p.goto(URL);
  await p.waitForFunction(() => window.__wi, null, { timeout: 30000 });
  return { p, ctx };
}

async function drag(p, word, steps = 8) {
  const pts = await p.evaluate((word) => {
    const els = [...document.querySelectorAll('.wheel .letter')];
    const used = new Set();
    return [...word].map((ch) => {
      const i = els.findIndex((x, k) => x.textContent === ch && !used.has(k));
      used.add(i);
      const r = els[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }, word);
  await p.mouse.move(pts[0].x, pts[0].y);
  await p.mouse.down();
  for (const q of pts.slice(1)) await p.mouse.move(q.x, q.y, { steps });
  await p.waitForTimeout(80);
  await p.mouse.up();
}

const words = (p) => p.evaluate(() => window.__wi.app.level.words.map((w) => w.word));

async function shots(browser) {
  const jobs = [
    // [file, w, h, dpr, save, action]
    ['01-desktop-title.png', 1920, 1080, 1, save('en', 1), null],
    ['02-desktop-level-en.png', 1920, 1080, 1, save('en', 1, { found: ['ABLE'] }), 'play'],
    ['03-desktop-island-grows.png', 1920, 1080, 1, save('en', 1), 'complete'],
    ['04-desktop-winter-ru.png', 1920, 1080, 1, save('ru', 2, { found: ['ТОРС'] }), 'play'],
    ['05-phone-tutorial-en.png', 390, 844, 2, null, null],
    ['06-phone-level-fr.png', 390, 844, 2, save('fr', 1, { found: ['SOIF'] }), 'play'],
    ['07-phone-level-ru.png', 390, 844, 2, save('ru', 2, { found: ['ТРОС'] }), 'play'],
    ['08-phone-sailing.png', 390, 844, 2, save('en', 1), 'sail'],
  ];
  for (const [file, w, h, dpr, s, action] of jobs) {
    const { p, ctx } = await page(browser, w, h, s, dpr);
    await p.waitForTimeout(2500);
    if (action === 'play' || action === 'complete' || action === 'sail') {
      await p.click('[data-testid=play]');
      await p.waitForTimeout(1200);
    }
    if (action === 'complete' || action === 'sail') {
      for (const wd of await words(p)) { await drag(p, wd); await p.waitForTimeout(1400); }
      await p.waitForTimeout(action === 'complete' ? 4200 : 1500);
    }
    if (action === 'sail') {
      await p.click('[data-testid=next]');
      await p.waitForTimeout(2600);
    }
    if (action === 'play') await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, file) });
    console.log('wrote', file);
    await ctx.close();
  }
}

/**
 * The video is recorded in slow motion: the game's global time scale (3D scene and UI timers) and the
 * CSS/Web-animation playback rate are lowered while Chrome's screencast records, then ffmpeg speeds
 * the recording back up to real time at 30 fps. This keeps the video fluid even when the capture
 * machine renders WebGL in software.
 */
async function video(browser) {
  const FPS = 30, SECONDS = 30, SLOW = 0.1;
  const dir = path.resolve('test-results/video');
  fs.rmSync(dir, { recursive: true, force: true });
  const created = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(([k]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem(k); } }, [KEY]);
  await p.goto(URL);
  await p.waitForFunction(() => window.__wi && document.querySelector('.wheel .letter') && !document.getElementById('boot'), null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
  await p.evaluate((s) => { window.__wi.timeScale.value = s; }, SLOW);
  const vnow = () => p.evaluate(() => window.__wi.world.time);
  const t0 = await vnow();
  const realStart = (Date.now() - created) / 1000;
  // waits are given in game seconds
  const until = async (vt) => { while ((await vnow()) - t0 < vt) await p.waitForTimeout(100); };
  let cursor = 0;
  const hold = async (sec) => { cursor += sec; await until(cursor); };
  async function letterPoints(word) {
    return p.evaluate((word) => {
      const els = [...document.querySelectorAll('.wheel .letter')];
      const used = new Set();
      return [...word].map((ch) => {
        const i = els.findIndex((x, k) => x.textContent === ch && !used.has(k));
        used.add(i);
        const r = els[i].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    }, word);
  }
  async function dragWord(word) {
    const pts = await letterPoints(word);
    await p.mouse.move(pts[0].x, pts[0].y);
    await p.mouse.down();
    await hold(0.12);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (let s = 1; s <= 5; s++) { await p.mouse.move(a.x + ((b.x - a.x) * s) / 5, a.y + ((b.y - a.y) * s) / 5); await hold(0.04); }
      await hold(0.08);
    }
    await p.mouse.up();
  }
  const ready = () => p.evaluate(() => !!document.querySelector('.wheel .letter') && !window.__wi.app.busy);
  const syncCursor = async () => { cursor = (await vnow()) - t0; };

  await hold(1.4); // the tutorial hand demonstrates the first word
  for (let lv = 0; lv < 3 && cursor < SECONDS; lv++) {
    for (const wd of await words(p)) { await dragWord(wd); await hold(lv === 0 ? 0.9 : 0.6); }
    if (lv === 2) break;
    await hold(2.2); // level complete: the island grows
    await p.getByTestId('next').click();
    while (!(await ready()) && (await vnow()) - t0 < SECONDS) await p.waitForTimeout(200); // the boat sails after level 2
    await syncCursor();
    await hold(0.3);
  }
  await until(SECONDS + 0.5);
  const v = p.video();
  await ctx.close();
  const webm = await v.path();
  const mp4 = path.join(OUT, 'gameplay-390x844.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', realStart.toFixed(2), '-i', webm, '-t', String(SECONDS / SLOW),
    '-vf', `setpts=${SLOW}*PTS,fps=${FPS},scale=390:844:flags=lanczos`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4);
}

const browser = await chromium.launch({ args: ARGS });
const what = process.argv[2] ?? 'all';
if (what === 'all' || what === 'shots') await shots(browser);
if (what === 'all' || what === 'video') await video(browser);
await browser.close();
