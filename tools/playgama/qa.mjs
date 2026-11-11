#!/usr/bin/env node
// Playgama QA Tool harness, adapted from Mahjong Jade Garden's scripts/playgama/qa.mjs: runs the Playgama build the way
// Playgama's archive check and QA Tool do — inside an iframe with `?platform_id=qa_tool` — and plays the QA Tool's side
// of Bridge's `qa_tool` postMessage protocol (initialize → get_player → liveness/ping; storage through
// get_data_from_storage / set_data_to_storage). Bridge is loaded from Playgama's CDN exactly as in the zip
// (PLAYGAMA_BRIDGE_FILE=<path> serves a local copy of the official Bridge instead, for machines that cannot reach it).
//
// Fails unless:
//   1. Bridge sends the QA Tool its `platform/initialize` handshake ("Bridge never initialized" is about this),
//   2. Bridge finishes initializing (`liveness/ping`),
//   3. the game sends `platform/game_ready` after that, and no gameplay message (level_started, …) comes before it,
//   4. the game boots and is playable, bridge.platform.id is qa_tool, no page error, no request leaves the build
//      except the Bridge CDN.
// Then the two failure paths (Bridge script blocked, initialize() rejecting): each must be logged with console.error
// ("[Playgama Bridge] …") and the game must still boot.
// Usage: node tools/playgama/qa.mjs <zip | build folder>
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const BRIDGE_CDN = 'https://bridge.playgama.com/';
const TIMEOUT = 45_000;
const target = resolve(process.argv[2] ?? 'submission-playgama/word-islands-playgama-v2.zip');
let dir = target;
if (target.endsWith('.zip')) {
  dir = mkdtempSync(join(tmpdir(), 'playgama-qa-'));
  execFileSync('unzip', ['-q', target, '-d', dir]);
}
const LOCAL_BRIDGE = process.env.PLAYGAMA_BRIDGE_FILE;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
const HOST = `<!doctype html><html><body style="margin:0"><iframe id="f" style="border:0;width:960px;height:600px" src="/game/index.html?platform_id=qa_tool"></iframe></body></html>`;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(HOST);
  const p = join(dir, decodeURIComponent(url.pathname.replace(/^\/game\//, '')));
  if (!url.pathname.startsWith('/game/') || !p.startsWith(dir) || !existsSync(p) || statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const errors = [];
const fail = (m) => (errors.push(m), console.log(`  ✗ ${m}`));
const ok = (m) => console.log(`  ✓ ${m}`);
const expect = (cond, msg, detail = '') => (cond ? ok(msg) : fail(`${msg}${detail ? ` (${detail})` : ''}`));
const bridgeRoute = (route) =>
  LOCAL_BRIDGE ? route.fulfill({ contentType: 'text/javascript', body: readFileSync(LOCAL_BRIDGE, 'utf8') }) : route.continue();
const gameReady = (frame) => frame.waitForSelector('.wheel .letter, [data-testid=play]', { timeout: TIMEOUT });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
const page = await ctx.newPage();
const external = [];
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
  const u = route.request().url();
  if (u.startsWith(BRIDGE_CDN)) return bridgeRoute(route);
  external.push(u);
  return route.abort();
});
// the QA Tool's side, in the host page (the iframe's parent)
const transcript = [];
await page.exposeFunction('__qaLog', (dirn, m) => transcript.push({ t: Date.now(), dirn, m }));
await page.addInitScript(() => {
  if (window !== window.top) return;
  const store = {};
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.source !== 'bridge' || !d.type) return;
    window.__qaLog('in', { type: d.type, action: d.action });
    const reply = (extra) => {
      const msg = { type: d.type, action: d.action, ...(d.id ? { id: d.id } : {}), ...extra };
      window.__qaLog('out', { type: msg.type, action: msg.action });
      e.source.postMessage(msg, '*');
    };
    const key = d.options?.key;
    if (d.type === 'platform' && d.action === 'initialize')
      reply({ supportedFeatures: ['isInterstitialSupported', 'isRewardedSupported'], config: { platformLanguage: 'en', deviceType: 'desktop' } });
    else if (d.type === 'player' && d.action === 'get_player') reply({ player: { isAuthorized: false } });
    else if (d.type === 'storage' && d.action === 'get_data_from_storage') reply({ storage: { [key]: store[key] ?? null } });
    else if (d.type === 'storage' && d.action === 'set_data_to_storage') store[key] = d.options.value;
    else if (d.type === 'storage' && d.action === 'delete_data_from_storage') delete store[key];
    else if (d.type === 'platform' && d.action === 'get_server_time') reply({ time: Date.now() });
    else if (d.id) reply({});
  });
});

const t0 = Date.now();
await page.goto(`${origin}/`);
const frame = await (await page.waitForSelector('#f')).contentFrame();
const seen = (type, action) => transcript.find((x) => x.dirn === 'in' && x.m.type === type && x.m.action === action);
const until = async (fn) => {
  while (!fn() && Date.now() - t0 < TIMEOUT) await new Promise((r) => setTimeout(r, 100));
  return fn();
};
console.log(`Playgama QA Tool harness: ${target}`);
console.log(`  iframe: /game/index.html?platform_id=qa_tool (Bridge from ${LOCAL_BRIDGE ? `local copy ${LOCAL_BRIDGE}` : BRIDGE_CDN})`);
const init = await until(() => seen('platform', 'initialize'));
expect(init, 'Bridge sent the QA Tool its initialize handshake (qa_tool adapter loaded)', 'no platform/initialize message: Bridge never initialized for the QA Tool');
const alive = await until(() => seen('liveness', 'ping'));
expect(alive, 'Bridge initialized (liveness ping after the QA Tool answered)');
const ready = await until(() => seen('platform', 'game_ready'));
expect(ready, 'game sent platform.sendMessage("game_ready") to the QA Tool');
if (alive && ready) expect(ready.t >= alive.t, 'game_ready only after Bridge finished initializing');
let booted = true;
try {
  await gameReady(frame);
} catch (e) {
  booted = e.message.split('\n')[0];
}
expect(booted === true, 'the game booted and is playable', String(booted));
// a new player's first level starts right away: level_started must follow game_ready
await until(() => seen('platform', 'level_started'));
const GAMEPLAY = new Set(['level_started', 'level_completed', 'level_failed', 'level_paused', 'level_resumed', 'gameplay_started', 'gameplay_stopped', 'in_game_loading_started', 'in_game_loading_stopped', 'player_got_achievement']);
const lifecycle = transcript.filter((x) => x.dirn === 'in' && x.m.type === 'platform' && (x.m.action === 'game_ready' || GAMEPLAY.has(x.m.action))).map((x) => x.m.action);
const early = lifecycle.slice(0, Math.max(0, lifecycle.indexOf('game_ready'))).filter((a) => GAMEPLAY.has(a));
expect(lifecycle[0] === 'game_ready' && !early.length, 'game_ready is the first lifecycle message: no level_started / gameplay event before it', lifecycle.join(' → ') || 'none');
const id = await frame.evaluate(() => window.bridge?.platform?.id).catch(() => null);
expect(id === 'qa_tool', 'bridge.platform.id is qa_tool', String(id));
const initFailed = consoleErrors.filter((m) => /initialize\(\) failed|INITIALIZATION_FAILED/i.test(m));
expect(!initFailed.length, 'no Bridge initialization error in the console', initFailed.join(' | '));
expect(!pageErrors.length, 'no page errors', pageErrors.join(' | '));
expect(!external.length, `no request outside the build except ${BRIDGE_CDN}`, external.join(', '));
console.log('\n  transcript (game → QA Tool "in", QA Tool → game "out"):');
for (const x of transcript) console.log(`    +${String(x.t - t0).padStart(5)} ms  ${x.dirn.padEnd(3)} ${x.m.type}/${x.m.action}`);
await ctx.close();

// failure paths: logged loudly, game still playable
const FAILURES = {
  'Bridge script blocked': (route) => route.abort(),
  'bridge.initialize() rejects': (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'window.bridge = { initialize: () => Promise.reject(new Error("qa harness: initialize rejected")) };' }),
};
for (const [name, handle] of Object.entries(FAILURES)) {
  console.log(`\nfailure path: ${name}`);
  const c = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const p = await c.newPage();
  const logged = [];
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => (route.request().url().startsWith(BRIDGE_CDN) ? handle(route) : route.abort()));
  await p.goto(`${origin}/`);
  const f = await (await p.waitForSelector('#f')).contentFrame();
  let up = true;
  try {
    await gameReady(f);
  } catch (e) {
    up = e.message.split('\n')[0];
  }
  const loud = logged.filter((m) => m.includes('[Playgama Bridge]'));
  expect(loud.length > 0, 'the failure is logged with console.error ([Playgama Bridge] …)', logged.join(' | ') || 'nothing logged');
  expect(up === true, 'the game still boots and is playable', String(up));
  expect(!errs.length, 'no page errors', errs.join(' | '));
  await c.close();
}
await browser.close();
server.close();
console.log(errors.length ? `\nFAILED: ${errors.length} problem(s)` : '\nPlaygama QA Tool harness: all checks passed');
process.exit(errors.length ? 1 : 0);
