#!/usr/bin/env node
/**
 * Builds the portal submission folders from dist/<platform> builds:
 *   submission/          CrazyGames: game zip, covers 1920x1080 / 800x1200 / 800x800 (top-left kept clear),
 *                        trailers 1920x1080 and 1080x1620 (~18 s)
 *   submission-gd/       GameDistribution: zip (index.html at root), JPG thumbnails 512x384, 512x512, 200x120, 1280x720, 1280x550
 *   submission-gamepix/  GamePix: zip, icon-256x256.jpg, cover-1360x850.jpg, description.txt, how-to-play.txt
 *   submission-playgama/ Playgama: zip, covers 800x800 / 1080x1920 / 1920x1080, icon 512x512
 *   submission-web/      ad-free web zip, cover-630x500.png, 4 screenshots 1280x720
 *
 * Usage: npm run build:all && npx vite preview --outDir dist/web --port 4173 &
 *        node tools/make-submission.mjs [zips|images|trailers|all]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const URL = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
const ROOT = path.resolve('.');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const KEY = 'word-islands.save.v1';
const DIRS = {
  crazygames: 'submission',
  gd: 'submission-gd',
  gamepix: 'submission-gamepix',
  playgama: 'submission-playgama',
  web: 'submission-web',
};
for (const d of Object.values(DIRS)) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
const out = (platform, file) => path.join(ROOT, DIRS[platform], file);

// ------------------------------------------------------------------ texts
const TEXT = {
  title: 'Word Islands',
  short: 'Connect letters, fill cozy crosswords and restore a chain of 3D islands as you sail between them.',
  description:
    'Sail across a sunny archipelago and bring each island back to life with words! Swipe across the letter wheel to spell words and fill the little crossword. Every solved level grows your island: palm trees, a hut, a windmill, a glowing lighthouse and more. ' +
    '100 levels on 8 hand-crafted islands, a daily puzzle with streaks, bonus words, hints and achievements. Plays in English, French, German, Spanish, Italian and Russian.',
  howTo:
    'Drag across the letters on the wheel (or type them on your keyboard and press Enter) to make a word. Words that fit the crossword fly into the grid; fill the whole grid to finish the level and grow your island. ' +
    'Extra valid words are bonus words and give coins. Shuffle is free; Hint reveals one letter (the first hint in each level is free) and Reveal shows a whole word.',
  controls: 'Mouse / touch: drag across letters, release to submit. Keyboard: type letters, Enter to submit, Backspace to delete.',
  tags: 'word, puzzle, crossword, casual, relaxing, 3d, islands, brain, vocabulary, family',
};

function writeTexts() {
  const common = `# ${TEXT.title}\n\n## Short description\n${TEXT.short}\n\n## Description\n${TEXT.description}\n\n## How to play\n${TEXT.howTo}\n\n## Controls\n${TEXT.controls}\n\n## Tags\n${TEXT.tags}\n\n## Languages\nEnglish, French, German, Spanish, Italian, Russian (auto-detected from the platform, switchable in Settings).\n`;
  for (const p of Object.keys(DIRS)) fs.writeFileSync(out(p, 'README.md'), common);
  if (TEXT.description.length < 100 || TEXT.description.length > 500) console.warn('GamePix description length', TEXT.description.length);
  if (TEXT.howTo.length > 500) throw new Error(`how-to-play is ${TEXT.howTo.length} chars (max 500)`);
  fs.writeFileSync(out('gamepix', 'description.txt'), TEXT.description + '\n');
  fs.writeFileSync(out('gamepix', 'how-to-play.txt'), TEXT.howTo + '\n');
  console.log(`texts written (description ${TEXT.description.length} chars, how-to-play ${TEXT.howTo.length} chars)`);
}

// ------------------------------------------------------------------ zips
function zips() {
  const names = { crazygames: 'word-islands-crazygames.zip', gd: 'word-islands-gd.zip', gamepix: 'word-islands-gamepix.zip', playgama: 'word-islands-playgama.zip', web: 'word-islands-web.zip' };
  for (const [platform, name] of Object.entries(names)) {
    const dist = path.join(ROOT, 'dist', platform);
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`missing build ${dist} (run npm run build:all)`);
    const zip = out(platform, name);
    fs.rmSync(zip, { force: true });
    // -X: no extra attributes; files are added relative to the build folder so index.html is at the root
    execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: dist });
    console.log(`${name}: ${(fs.statSync(zip).size / 1024 / 1024).toFixed(2)} MB`);
  }
}

// ------------------------------------------------------------------ images
const ALL_ACH = ['first_word', 'level_10', 'level_50', 'level_100', 'island_1', 'island_4', 'island_8', 'bonus_10', 'bonus_100', 'words_500', 'no_hint_10', 'daily_1', 'daily_7'];
const save = (lang, level, extra = {}) => ({
  version: 1, lang, music: false, sound: false, coins: 120, tutorialDone: true,
  progress: { [lang]: { level, found: extra.found ?? [], bonus: [], revealed: [], freeHintUsed: false } },
  achievements: ALL_ACH, // keep achievement toasts out of the marketing shots
});

async function open(browser, w, h, s) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
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

/**
 * Key art: a fully restored island rendered at the exact size, with the logo and a few glossy
 * letter tiles laid out for the format. `clearTopLeft` keeps the top-left quarter empty (CrazyGames).
 */
async function poster(browser, file, w, h, opts = {}) {
  const { island = 0, clearTopLeft = false, icon = false, render = 1 } = opts;
  const W = Math.round(w * render), H = Math.round(h * render);
  const { p, ctx } = await open(browser, W, H, save('en', 0));
  await p.evaluate(([island, W, H, clearTopLeft, icon]) => {
    document.getElementById('app').innerHTML = '';
    const w = window.__wi.world;
    w.showIsland(island);
    w.setProgress(99, 26, 1, false);
    const portrait = H > W * 1.1;
    const rect = icon ? { x: 0, y: H * 0.28, w: W, h: H * 0.72 }
      : portrait ? { x: 0, y: H * 0.42, w: W, h: H * 0.5 }
      : clearTopLeft ? { x: W * 0.36, y: H * 0.22, w: W * 0.64, h: H * 0.78 }
      : { x: W * 0.4, y: H * 0.08, w: W * 0.6, h: H * 0.9 };
    w.setViewRect(rect);
    const unit = Math.min(W, H) / 100;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:Nunito,system-ui,sans-serif;';
    const tile = (ch, x, y, s) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${s * 0.22}px;background:linear-gradient(180deg,#fffdf6,#f7e6c0);box-shadow:0 ${s * 0.08}px 0 #d7b77a,0 ${s * 0.16}px ${s * 0.3}px rgba(10,40,70,.35);display:grid;place-items:center;font-weight:900;font-size:${s * 0.62}px;color:#18324f">${ch}</div>`;
    const logo = (size, align) => `<div class="logo" style="animation:none;text-align:${align}"><span class="w1" style="font-size:${size}px">Word</span><span class="w2" style="font-size:${size * 1.18}px">Islands</span></div>`;
    let html = '';
    if (icon) {
      const s = W * 0.34;
      html = tile('W', W * 0.5 - s * 0.5, H * 0.08, s) + `<div style="position:absolute;inset:0;box-shadow:inset 0 0 ${W * 0.08}px rgba(0,0,0,.25)"></div>`;
    } else if (portrait) {
      const s = unit * 13;
      html = `<div style="position:absolute;left:0;right:0;top:${H * 0.06}px">${logo(unit * 17, 'center')}</div>`;
      const x0 = W / 2 - s * 2.1;
      ['S', 'A', 'I', 'L'].forEach((c, i) => { html += tile(c, x0 + i * s * 1.08, H * 0.3, s); });
    } else {
      const s = unit * 11;
      const lx = clearTopLeft ? W * 0.05 : W * 0.06;
      const ly = clearTopLeft ? H * 0.5 : H * 0.18;
      html = `<div style="position:absolute;left:${lx}px;top:${ly}px">${logo(unit * (clearTopLeft ? 12.5 : 15), 'left')}</div>`;
      const ty = ly + unit * (clearTopLeft ? 30 : 37);
      ['S', 'A', 'I', 'L'].forEach((c, i) => { html += tile(c, lx + i * s * 1.08, ty, s); });
    }
    ov.innerHTML = html;
    document.body.appendChild(ov);
  }, [island, W, H, clearTopLeft, icon]);
  await p.waitForTimeout(4500);
  const buf = await p.screenshot({ timeout: 180000 });
  await ctx.close();
  let img = sharp(buf);
  if (render !== 1) img = img.resize(w, h);
  if (file.endsWith('.jpg')) await img.jpeg({ quality: 90 }).toFile(file);
  else await img.png().toFile(file);
  console.log('wrote', path.relative(ROOT, file));
  return file;
}

async function gameplayShots(browser) {
  const jobs = [
    ['screenshot-1-windmill-meadows.png', save('en', 25), 'play'],
    ['screenshot-2-island-grows.png', save('en', 9), 'complete'],
    ['screenshot-3-frost-harbor.png', save('en', 10), 'play'],
    ['screenshot-4-blossom-isle.png', save('en', 76), 'play'],
  ];
  for (const [name, s, action] of jobs) {
    const { p, ctx } = await open(browser, 1280, 720, s);
    await p.waitForTimeout(1500);
    await p.click('[data-testid=play]');
    await p.waitForTimeout(1500);
    const words = await p.evaluate(() => window.__wi.app.level.words.map((w) => w.word));
    const n = action === 'complete' ? words.length : Math.max(1, words.length - 2);
    for (const wd of words.slice(0, n)) {
      await p.evaluate((wd) => { for (const ch of wd) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch.toLowerCase() })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }, wd);
      await p.waitForTimeout(1600);
    }
    await p.waitForTimeout(action === 'complete' ? 4500 : 1500);
    await p.screenshot({ path: out('web', name), timeout: 180000 });
    console.log('wrote', name);
    await ctx.close();
  }
}

async function images() {
  const browser = await chromium.launch({ args: ARGS });
  // CrazyGames covers (top-left corner kept clear for the portal's badges)
  await poster(browser, out('crazygames', 'cover-1920x1080.png'), 1920, 1080, { clearTopLeft: true });
  await poster(browser, out('crazygames', 'cover-800x1200.png'), 800, 1200, { island: 2 });
  await poster(browser, out('crazygames', 'cover-800x800.png'), 800, 800, { clearTopLeft: true, island: 1 });
  // Playgama covers + icon
  await poster(browser, out('playgama', 'cover-1920x1080.png'), 1920, 1080, { island: 0 });
  await poster(browser, out('playgama', 'cover-1080x1920.png'), 1080, 1920, { island: 6 });
  await poster(browser, out('playgama', 'cover-800x800.png'), 800, 800, { island: 1 });
  await poster(browser, out('playgama', 'icon-512x512.png'), 512, 512, { icon: true });
  // GameDistribution JPG thumbnails
  const gd = [[512, 384], [512, 512], [200, 120], [1280, 720], [1280, 550]];
  for (const [w, h] of gd) await poster(browser, out('gd', `thumb-${w}x${h}.jpg`), w, h, { island: w === h ? 1 : 0, render: w < 400 ? 3 : 1 });
  // GamePix
  await poster(browser, out('gamepix', 'icon-256x256.jpg'), 256, 256, { icon: true, render: 2 });
  await poster(browser, out('gamepix', 'cover-1360x850.jpg'), 1360, 850, { island: 0 });
  // Web
  await poster(browser, out('web', 'cover-630x500.png'), 630, 500, { island: 0 });
  await gameplayShots(browser);
  await browser.close();
}

// ------------------------------------------------------------------ trailers
async function trailer(browser, file, w, h, seconds = 18) {
  const SLOW = 0.05, FPS = 30;
  const dir = path.resolve('test-results/trailer');
  fs.rmSync(dir, { recursive: true, force: true });
  const created = Date.now();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
  const p = await ctx.newPage();
  await p.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, [KEY, JSON.stringify(save('en', 9))]);
  await p.goto(URL);
  await p.waitForFunction(() => window.__wi && !document.getElementById('boot'), null, { timeout: 60000 });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
  await p.evaluate((s) => { window.__wi.timeScale.value = s; }, SLOW);
  const vnow = () => p.evaluate(() => window.__wi.world.time);
  const t0 = await vnow();
  const realStart = (Date.now() - created) / 1000;
  const until = async (vt) => { while ((await vnow()) - t0 < vt) await p.waitForTimeout(150); };
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
  await hold(1.8); // title screen
  const box = await p.getByTestId('play').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await hold(0.8);
  const words = await p.evaluate(() => window.__wi.app.level.words.map((w) => w.word));
  for (const wd of words) { await drag(wd); await hold(0.75); }
  await hold(2.4); // island grows
  const nb = await p.getByTestId('next').boundingBox();
  await p.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
  await until(seconds + 0.3);
  const v = p.video();
  await ctx.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', realStart.toFixed(2), '-i', await v.path(), '-t', String(seconds / SLOW),
    '-vf', `setpts=${SLOW}*PTS,fps=${FPS},scale=${w}:${h}:flags=lanczos`, '-t', String(seconds), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', file]);
  console.log('wrote', path.relative(ROOT, file));
}

async function trailers() {
  const browser = await chromium.launch({ args: ARGS });
  await trailer(browser, out('crazygames', 'trailer-1920x1080.mp4'), 1920, 1080);
  await trailer(browser, out('crazygames', 'trailer-1080x1620.mp4'), 1080, 1620);
  await browser.close();
}

const what = process.argv[2] ?? 'all';
writeTexts();
if (what === 'zips' || what === 'all') zips();
if (what === 'images' || what === 'all') await images();
if (what === 'trailers' || what === 'all') await trailers();
if (what === 'shots') { const b = await chromium.launch({ args: ARGS }); await gameplayShots(b); await b.close(); }
