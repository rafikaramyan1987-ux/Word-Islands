/**
 * Shared rendering helpers for the GameMonetize and Y8 submission media (tools/gamemonetize/images.mjs,
 * tools/y8/media.mjs). Everything is rendered from the real game (dist/web served by `vite preview`, the same game as
 * every portal build, without any SDK) in headless Chromium with SwiftShader, as tools/make-submission.mjs does.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const URL = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
export const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const KEY = 'word-islands.save.v1';
const ALL_ACH = ['first_word', 'level_10', 'level_50', 'level_100', 'island_1', 'island_4', 'island_8', 'bonus_10', 'bonus_100', 'words_500', 'no_hint_10', 'daily_1', 'daily_7'];
/** a returning English player at `level` (achievements already unlocked, so no toasts in the shots) */
export const save = (level, extra = {}) => ({
  version: 1, lang: 'en', music: false, sound: false, coins: 120, tutorialDone: true,
  progress: { en: { level, found: extra.found ?? [], bonus: [], revealed: [], freeHintUsed: false } },
  achievements: ALL_ACH,
});

export const launch = () => chromium.launch({ args: ARGS });

export async function open(browser, w, h, s, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    if (v) localStorage.setItem(k, v);
  }, [KEY, s ? JSON.stringify(s) : null]);
  await p.goto(URL);
  await p.waitForFunction(() => window.__wi && !document.getElementById('boot'), null, { timeout: 60000 });
  return { p, ctx };
}

/** write `buf` as a JPEG at w x h, lowering the quality until it is under `limit` bytes */
export async function jpeg(buf, file, w, h, limit) {
  for (let q = 90; q >= 50; q -= 4) {
    await sharp(buf).resize(w, h, { kernel: 'lanczos3' }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(file);
    const size = fs.statSync(file).size;
    if (size < limit) {
      console.log(`wrote ${file} (${w}x${h}, ${(size / 1024).toFixed(0)} KB, q${q})`);
      return file;
    }
  }
  throw new Error(`${file}: cannot get under ${limit} bytes`);
}

/**
 * The cover / title scene: a fully restored island in the sunny sea, rendered at `render` x the size.
 * `logo: false` = no text and no logo at all (GameMonetize thumbnails); `logo: true` = the game logo and SAIL tiles.
 */
export async function cover(browser, file, w, h, { island = 0, logo = false, render = 2, limit = 5 * 1024 * 1024 } = {}) {
  const W = Math.round(w * render), H = Math.round(h * render);
  const { p, ctx } = await open(browser, W, H, save(0));
  await p.evaluate(([island, W, H, logo]) => {
    document.getElementById('app').innerHTML = '';
    document.querySelectorAll('.toast').forEach((e) => e.remove());
    const w = window.__wi.world;
    w.showIsland(island);
    w.setProgress(99, 26, 1, false);
    const portrait = H > W * 1.1;
    const rect = !logo ? { x: W * 0.06, y: H * 0.04, w: W * 0.88, h: H * 0.94 }
      : portrait ? { x: 0, y: H * 0.42, w: W, h: H * 0.5 }
      : { x: W * 0.4, y: H * 0.08, w: W * 0.6, h: H * 0.9 };
    w.setViewRect(rect);
    if (!logo) return;
    const unit = Math.min(W, H) / 100;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:Nunito,system-ui,sans-serif;';
    const tile = (ch, x, y, s) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${s * 0.22}px;background:linear-gradient(180deg,#fffdf6,#f7e6c0);box-shadow:0 ${s * 0.08}px 0 #d7b77a,0 ${s * 0.16}px ${s * 0.3}px rgba(10,40,70,.35);display:grid;place-items:center;font-weight:900;font-size:${s * 0.62}px;color:#18324f">${ch}</div>`;
    const lg = (size, align) => `<div class="logo" style="animation:none;text-align:${align}"><span class="w1" style="font-size:${size}px">Word</span><span class="w2" style="font-size:${size * 1.18}px">Islands</span></div>`;
    let html = '';
    if (portrait) {
      const s = unit * 13;
      html = `<div style="position:absolute;left:0;right:0;top:${H * 0.06}px">${lg(unit * 17, 'center')}</div>`;
      const x0 = W / 2 - s * 2.1;
      ['S', 'A', 'I', 'L'].forEach((c, i) => { html += tile(c, x0 + i * s * 1.08, H * 0.3, s); });
    } else {
      const s = unit * 11;
      const lx = W * 0.06, ly = H * 0.18;
      html = `<div style="position:absolute;left:${lx}px;top:${ly}px">${lg(unit * 15, 'left')}</div>`;
      ['S', 'A', 'I', 'L'].forEach((c, i) => { html += tile(c, lx + i * s * 1.08, ly + unit * 37, s); });
    }
    ov.innerHTML = html;
    document.body.appendChild(ov);
  }, [island, W, H, logo]);
  await p.waitForTimeout(4500);
  const buf = await p.screenshot({ timeout: 180000 });
  await ctx.close();
  return jpeg(buf, file, w, h, limit);
}

const typeWord = (p, wd) => p.evaluate((wd) => {
  for (const ch of wd) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch.toLowerCase() }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
}, wd);

/** a real gameplay moment: open `level`, play `n` of its words (all = level complete), screenshot */
export async function gameplay(browser, file, w, h, level, { leave = 2, complete = false, limit = 2 * 1024 * 1024 } = {}) {
  const { p, ctx } = await open(browser, w, h, save(level));
  await p.waitForTimeout(1500);
  await p.click('[data-testid=play]');
  await p.waitForTimeout(1500);
  const words = await p.evaluate(() => window.__wi.app.level.words.map((x) => x.word));
  const n = complete ? words.length : Math.max(1, words.length - leave);
  for (const wd of words.slice(0, n)) {
    await typeWord(p, wd);
    await p.waitForTimeout(1600);
  }
  await p.waitForTimeout(complete ? 4500 : 1500);
  const buf = await p.screenshot({ timeout: 180000 });
  await ctx.close();
  return jpeg(buf, file, w, h, limit);
}

/**
 * One continuous take of real play, recorded in slowed virtual time and played back at real speed (as the CrazyGames
 * trailers in tools/make-submission.mjs): the menu for a moment, Play, the last level of Sunny Lagoon (level 10) solved
 * word by word, the island restored, Next, the sail to the next island, then the first level there.
 */
export async function gameplayVideo(browser, file, w, h, seconds = 26) {
  const SLOW = 0.05, FPS = 30;
  const dir = path.resolve('test-results/portal-video');
  fs.rmSync(dir, { recursive: true, force: true });
  const created = Date.now();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
  const p = await ctx.newPage();
  await p.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, [KEY, JSON.stringify(save(9))]);
  await p.goto(URL);
  await p.waitForFunction(() => window.__wi && !document.getElementById('boot'), null, { timeout: 60000 });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
  await p.evaluate((s) => { window.__wi.timeScale.value = s; }, SLOW);
  const vnow = () => p.evaluate(() => window.__wi.world.time);
  const t0 = await vnow();
  const realStart = (Date.now() - created) / 1000;
  const elapsed = async () => (await vnow()) - t0;
  const until = async (vt) => { while ((await elapsed()) < vt) await p.waitForTimeout(150); };
  let cursor = 0;
  const hold = async (sec) => { cursor += sec; await until(cursor); };
  const drag = async (word) => {
    const pts = await p.evaluate((word) => {
      const els = [...document.querySelectorAll('.wheel .letter')];
      const used = new Set();
      return [...word].map((ch) => { const i = els.findIndex((x, k) => x.textContent === ch && !used.has(k)); used.add(i); const r = els[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    }, word);
    await p.mouse.move(pts[0].x, pts[0].y);
    await p.mouse.down();
    await hold(0.1);
    for (let i = 1; i < pts.length; i++) {
      for (let s = 1; s <= 4; s++) { await p.mouse.move(pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * s) / 4, pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * s) / 4); await hold(0.035); }
      await hold(0.06);
    }
    await p.mouse.up();
  };
  const clickTestId = async (id) => {
    const b = await p.getByTestId(id).boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  await hold(1.0); // menu
  await clickTestId('play');
  await hold(0.7);
  for (const wd of await p.evaluate(() => window.__wi.app.level.words.map((x) => x.word))) { await drag(wd); await hold(0.7); }
  await hold(2.6); // the island is restored
  await clickTestId('next');
  // sail to the next island, then play there until the clip is full
  await p.waitForFunction(() => document.querySelector('.wheel .letter'), null, { timeout: 600000 });
  cursor = Math.max(cursor, await elapsed()) + 0.6;
  await until(cursor);
  for (const wd of await p.evaluate(() => window.__wi.app.level.words.map((x) => x.word))) {
    if (cursor > seconds - 1.5) break;
    await drag(wd);
    await hold(0.7);
  }
  await until(seconds + 0.3);
  const v = p.video();
  await ctx.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', realStart.toFixed(2), '-i', await v.path(), '-t', String(seconds / SLOW),
    '-vf', `setpts=${SLOW}*PTS,fps=${FPS},scale=${w}:${h}:flags=lanczos`, '-t', String(seconds), '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', file]);
  console.log(`wrote ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
  fs.rmSync(dir, { recursive: true, force: true });
}
