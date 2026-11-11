#!/usr/bin/env node
// CI check for the GamePix build (folder or zip):
// - index.html at the root, window.GamePixConfig = { lifecycle: 'manual' } then the GamePix SDK v3 script (once),
//   both before the game bundle
// - the bundle uses the v3 API (lifecycle.loading/loaded/gameStart, ads.interstitial/ads.reward, events.on) and keeps
//   the legacy GamePix.soundOff/soundOn/pause/resume assignments; no rewardAd()/interstitialAd() legacy ad calls
// - no other portal SDK
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
const target = process.argv[2] ?? 'dist/gamepix';
const errors = [];
let html, js;
if (target.endsWith('.zip')) {
  const entries = execFileSync('unzip', ['-Z1', target]).toString().trim().split('\n');
  if (!entries.includes('index.html')) errors.push('index.html is not at the root of the zip');
  html = execFileSync('unzip', ['-p', target, 'index.html']).toString();
  js = entries.filter((e) => e.endsWith('.js')).map((e) => execFileSync('unzip', ['-p', target, e], { maxBuffer: 64 << 20 }).toString()).join('\n');
} else {
  html = fs.readFileSync(path.join(target, 'index.html'), 'utf8');
  js = fs.readdirSync(path.join(target, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(target, 'assets', f), 'utf8')).join('\n');
}
const tags = html.match(/<script[^>]*\bsrc="[^"]*gamepix\.sdk\.js"[^>]*><\/script>/g) || [];
if (tags.length !== 1 || !tags[0].includes(`src="${SDK_URL}"`)) errors.push(`the GamePix SDK must be loaded once from ${SDK_URL} (found ${tags.length})`);
const cfgAt = html.search(/window\.GamePixConfig\s*=\s*\{\s*lifecycle:\s*'manual'\s*\}/);
const sdkAt = html.indexOf(SDK_URL);
const bundleAt = html.indexOf('<script type="module"');
if (cfgAt < 0) errors.push("window.GamePixConfig = { lifecycle: 'manual' } is missing");
if (!(cfgAt >= 0 && sdkAt > cfgAt && bundleAt > sdkAt)) errors.push('order must be: GamePixConfig, then the SDK, then the game bundle');
for (const need of ['lifecycle?.loading', 'lifecycle.loaded', 'lifecycle.gameStart', 'ads.reward', 'ads.interstitial', 'GamePix.soundOff=', 'GamePix.soundOn=', 'GamePix.pause=', 'GamePix.resume=', 'happyMoment']) {
  if (!js.replace(/\s/g, '').includes(need)) errors.push(`the bundle does not contain ${need}`);
}
if (/\.success===!0/.test(js) === false && !/success\s*===\s*(true|!0)/.test(js)) errors.push('reward is not gated on success === true');
for (const bad of ['rewardAd(', 'interstitialAd(', 'crazygames-sdk', 'gamedistribution', 'GD_OPTIONS', 'playgama-bridge.js']) if (js.includes(bad) || html.includes(bad)) errors.push(`forbidden code found: ${bad}`);
if (errors.length) {
  console.error(`${target}: GamePix check FAILED\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`${target}: GamePix OK (manual lifecycle, SDK v3 once before the bundle, v3 API, legacy assignments, no other portal code)`);
