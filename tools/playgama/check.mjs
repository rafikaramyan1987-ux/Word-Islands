#!/usr/bin/env node
// File checks of the Playgama zip, adapted from Mahjong Jade Garden's scripts/playgama/check.mjs. Fails if
//  - index.html is not at the zip root, or a path is absolute / leaves the zip / is not Latin,
//  - the first script in <head> is not Playgama's CDN Bridge (https://bridge.playgama.com/v2/stable/playgama-bridge.js)
//    loaded normally (not async / defer / module),
//  - the second script is not the inline boot calling bridge.initialize(), or a failed initialize() would be silent,
//  - a game module script runs before bridge.initialize() has settled (it must be held as
//    <script type="text/plain" data-playgama-game>),
//  - the game code does not send platform.sendMessage('game_ready'),
//  - playgama-bridge-config.json is missing / not JSON / sets anything (Playgama's defaults: Bridge alone paces
//    interstitials), or a playgama-bridge.js is shipped (Bridge comes from the CDN),
//  - "crazygames", "gamedistribution" or "gamepix", or localStorage, appears in the zip,
//  - index.html loads anything from outside the zip except the Bridge CDN,
//  - Playgama's own precheck (tools/playgama/precheck.mjs, from the official playgama-publish skill) reports a FAIL
//    or a WARN.
// Usage: node tools/playgama/check.mjs <zip | build folder>
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const BRIDGE_CDN = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
const BANNED = ['crazygames', 'gamedistribution', 'gamepix', 'localstorage'];
const target = resolve(process.argv[2] ?? 'submission-playgama/word-islands-playgama-v2.zip');
const errors = [];
const fail = (m) => (errors.push(m), console.log(`  ✗ ${m}`));
const ok = (m) => console.log(`  ✓ ${m}`);
const check = (bad, badMsg, okMsg) => (bad ? fail(badMsg) : ok(okMsg));

let dir = target;
let entries;
if (target.endsWith('.zip')) {
  const size = statSync(target).size;
  console.log(`zip: ${target} (${size} bytes)`);
  check(size > 300 * 1024 * 1024, 'zip over 300 MB', `${(size / 1024).toFixed(0)} KB, under Playgama's 300 MB limit`);
  entries = execFileSync('unzip', ['-Z1', target], { encoding: 'utf8' }).split('\n').filter(Boolean);
  dir = mkdtempSync(join(tmpdir(), 'playgama-'));
  execFileSync('unzip', ['-q', target, '-d', dir]);
} else {
  const all = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : all.push(relative(dir, join(d, e.name)))));
  walk(dir);
  entries = all;
}
check(!entries.includes('index.html'), 'index.html is not at the root', 'index.html at the root');
const unsafe = entries.filter((e) => e.startsWith('/') || e.split('/').includes('..') || e.includes('\\') || /[^\x20-\x7e]/.test(e));
check(unsafe.length, `unsafe / non-Latin paths: ${unsafe.join(', ')}`, `${entries.length} files, relative Latin paths`);

if (entries.includes('index.html')) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const head = html.slice(0, html.search(/<\/head>/i));
  const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1], body: m[2], tag: `<script${m[1]}>` }));
  const [first, second] = scripts;
  check(!first || first.attrs.trim() !== `src="${BRIDGE_CDN}"`, `the first script in <head> is not a plain <script src="${BRIDGE_CDN}">: ${first?.tag}`, `Bridge from Playgama's CDN is the first script in <head>, loaded normally`);
  check(!second || second.attrs.trim() !== '' || !/window\.bridge\.initialize\(\)/.test(second.body), `the second script in <head> is not the inline boot calling bridge.initialize(): ${second?.tag}`, 'bridge.initialize() is called right after it, in a classic inline script');
  check(!/console\.error\(/.test(second?.body ?? ''), 'a failed bridge.initialize() would be silent', 'a failed bridge.initialize() is logged with console.error');
  const modules = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>/gi)].map((m) => m[0]);
  const held = [...html.matchAll(/<script type="text\/plain" data-playgama-game\b[^>]*>/g)];
  check(modules.length || !held.length, `the game bundle runs before bridge.initialize() settles (module scripts: ${modules.join(', ') || 'none'}, held: ${held.length})`, `the game bundle is held until bridge.initialize() has settled (${held.length} held script)`);
  const game = entries.filter((e) => /\.m?js$/.test(e)).map((e) => readFileSync(join(dir, e), 'utf8')).join('\n');
  check(!/["'`]game_ready["'`]/.test(game) || !/\.sendMessage\(/.test(game), "the game code never sends platform.sendMessage('game_ready')", "the game code sends platform.sendMessage('game_ready')");
  check(/minimumDelayBetweenInterstitial/.test(game + html), 'the game sets an interstitial delay itself (Bridge alone paces interstitials)', 'no interstitial delay set by the game');
  const ext = [...html.matchAll(/(?:src|href)\s*=\s*["']((?:\/(?!\/)|https?:|\/\/)[^"']*)/gi)].map((m) => m[1]).filter((u) => u !== BRIDGE_CDN);
  check(ext.length, `index.html has absolute / external paths: ${ext.join(', ')}`, 'index.html: relative paths only (and the Bridge CDN)');
}
check(entries.some((e) => /playgama-bridge[^/]*\.js$/.test(e)), 'a playgama-bridge.js is shipped: Bridge comes from the CDN', 'no Bridge copy shipped (Bridge comes from the CDN)');
try {
  const cfg = JSON.parse(readFileSync(join(dir, 'playgama-bridge-config.json'), 'utf8'));
  check(Object.keys(cfg).length, `playgama-bridge-config.json sets ${JSON.stringify(cfg)}: keep Playgama's defaults`, 'playgama-bridge-config.json beside index.html, Playgama defaults (no settings)');
} catch (e) {
  fail(`playgama-bridge-config.json missing or invalid: ${e.message}`);
}
const hits = [];
for (const e of entries.filter((x) => !x.endsWith("/"))) {
  const s = readFileSync(join(dir, e)).toString('latin1').toLowerCase();
  for (const b of BANNED) if (s.includes(b)) hits.push(`${e}: "${b}"`);
}
hits.forEach((h) => fail(`banned string in ${h}`));
if (!hits.length) ok(`no ${BANNED.join(' / ')} in any file`);

console.log("Playgama's precheck (tools/playgama/precheck.mjs):");
const pre = spawnSync(process.execPath, ['tools/playgama/precheck.mjs', dir], { encoding: 'utf8' });
const lines = pre.stdout.split('\n').filter((l) => /^(ok|warn|FAIL|note)\s/.test(l) || /^\s{13}\S/.test(l));
console.log(lines.map((l) => `    ${l}`).join('\n'));
check(pre.status !== 0, "Playgama's precheck reports FAIL", "Playgama's precheck: no FAIL");
check(lines.some((l) => /^warn\s/.test(l)), "Playgama's precheck reports a WARN", "Playgama's precheck: no WARN");
console.log(errors.length ? `\nFAILED: ${errors.length} problem(s)` : '\nall checks passed');
process.exit(errors.length ? 1 : 0);
