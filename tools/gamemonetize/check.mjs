#!/usr/bin/env node
// Static checks of a GameMonetize zip (tools/gamemonetize/zip.mjs) and the submission images. Fails if
//  - index.html is not at the zip root, a path in the zip is absolute / leaves the zip, or the zip is 50 MB or more,
//  - index.html references a file by a non-relative path, or the game names another URL than GameMonetize's sdk.js,
//  - the bundle lacks the game ID / sdk.js / the README loader id / SDK_GAME_PAUSE + SDK_GAME_START handling, or
//    contains another portal or ad network, an iframe, window.open or a "more games" link,
//  - a submission image is missing, not a 512x384 / 512x512 / 512x340 JPEG, or 300 KB or more.
// Usage: node tools/gamemonetize/check.mjs [zip] [--no-images]
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { checker, identify, nonRelative, readZip, urlsIn } from '../lib/zipcheck.mjs';

const args = process.argv.slice(2);
const zip = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'submission-gamemonetize/word-islands-gamemonetize-v1.zip');
const GAME_ID = '0cqkyktpv3nnr3nokt7jhqbzryqmfh2h';
const SDK = 'https://api.gamemonetize.com/sdk.js';
const BANNED = ['crazygames', 'gamedistribution', 'gamepix', 'playgama', 'y8.com', 'y8sdk', 'googlesyndication', 'adsbygoogle', '<iframe', 'window.open', 'more games'];
const { check, done } = checker();

const { text, all, html } = readZip(zip, check);
if (html) {
  const bad = nonRelative(html);
  check(bad.length, `index.html references non-relative paths: ${bad.join(', ')}`, 'index.html: every reference relative (./)');
}
const hits = [];
for (const [f, s] of text) for (const b of BANNED) if (s.toLowerCase().includes(b)) hits.push(`${f}: "${b}"`);
check(hits.length, `banned strings: ${hits.join('; ')}`, `no ${BANNED.join(' / ')} in the game`);
const other = urlsIn(all).filter((u) => u !== SDK);
check(other.length, `external URLs other than the SDK: ${other.join(', ')}`, `the only external URL is ${SDK}`);
check(!all.includes(SDK), `${SDK} missing`, 'GameMonetize sdk.js referenced');
check(!all.includes(GAME_ID), `game ID ${GAME_ID} missing`, `game ID ${GAME_ID} in the bundle`);
check(!all.includes('SDK_OPTIONS'), 'SDK_OPTIONS missing', 'window.SDK_OPTIONS set');
check(!all.includes('gamemonetize-sdk'), 'loader script id "gamemonetize-sdk" missing', 'README loader id "gamemonetize-sdk"');
check(!all.includes('SDK_GAME_PAUSE') || !all.includes('SDK_GAME_START') || !all.includes('SDK_READY'), 'SDK_GAME_PAUSE / SDK_GAME_START / SDK_READY handling missing', 'SDK_GAME_PAUSE / SDK_GAME_START / SDK_READY handled');

if (!args.includes('--no-images'))
  for (const [w, h] of [[512, 384], [512, 512], [512, 340]]) {
    const f = `submission-gamemonetize/word-islands-${w}x${h}.jpg`;
    if (!existsSync(f)) {
      check(true, `${f} missing`, '');
      continue;
    }
    const [iw, ih, fmt] = identify(f);
    const size = statSync(f).size;
    check(iw !== w || ih !== h || fmt !== 'JPEG' || size >= 300 * 1024, `${f}: ${iw}x${ih} ${fmt}, ${size} bytes (want ${w}x${h} JPEG < 300 KB)`, `${f}: ${w}x${h} JPEG, ${(size / 1024).toFixed(0)} KB`);
  }
done();
