#!/usr/bin/env node
// Static checks of a Y8 zip (tools/y8/zip.mjs) and the media in submission-y8/media. Fails if
//  - index.html is not at the zip root, a path in the zip is absolute / leaves the zip, or the zip is 50 MB or more,
//  - index.html references a game file by a non-relative path, or the game names another URL than Y8's CDN SDK,
//  - y8.min.js is not loaded from https://cdn.y8.com/minimal-sdk/2-0/y8.min.js with `async` in <head>, a copy of it is
//    bundled, or the App ID / Game ID / `y8sdk.ready` / emitReadyEvent / the ad callbacks are missing,
//  - another portal / ad network, an <iframe>, window.open or a "more games" link is in the game,
//  - a media file is missing, not the exact size, over its limit (2 MB for 760x570, 5 MB for the rest, 50 MB for videos),
//    or a video is not H.264 MP4 at 1280x720 / 960x720, 20–30 s.
// Usage: node tools/y8/check.mjs [zip] [--no-media]
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { checker, identify, nonRelative, readZip, urlsIn } from '../lib/zipcheck.mjs';

const args = process.argv.slice(2);
const zip = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'submission-y8/word-islands-y8-v1.zip');
const SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const BANNED = ['crazygames', 'gamedistribution', 'gamepix', 'playgama', 'gamemonetize', 'googlesyndication', 'adsbygoogle', 'adbreak(', '<iframe', 'window.open', 'more games'];
const { check, done } = checker();

const { files, text, all, html } = readZip(zip, check);
if (html) {
  const bad = nonRelative(html, [SDK]);
  check(bad.length, `index.html references non-relative paths: ${bad.join(', ')}`, 'index.html: every game reference relative (./)');
  const head = html.slice(0, html.indexOf('</head>'));
  check(!head.includes(`<script src="${SDK}" async></script>`), `no <script src="${SDK}" async> in <head>`, 'y8.min.js from the Y8 CDN, async, in <head>');
}
const hits = [];
for (const [f, s] of text) for (const b of BANNED) if (s.toLowerCase().includes(b)) hits.push(`${f}: "${b}"`);
check(hits.length, `banned strings: ${hits.join('; ')}`, `no ${BANNED.join(' / ')} in the game`);
const other = urlsIn(all).filter((u) => u !== SDK);
check(other.length, `external URLs other than the Y8 SDK: ${other.join(', ')}`, `the only external URL is ${SDK}`);
check(files.some((f) => /y8(\.min)?\.js$/i.test(f)), 'a copy of the Y8 SDK is bundled', 'no bundled copy of the Y8 SDK');
for (const [needle, what] of [
  ['6af4b1c73c0f1c5e7ad96ecf', 'App ID'],
  ['292549', 'Game ID'],
  ['y8sdk.ready', '"y8sdk.ready" listener'],
  ['emitReadyEvent', 'emitReadyEvent()'],
  ['autoLogin', 'autoLogin'],
  ['preloadAdBreaks', 'preloadAdBreaks'],
  ['onAuth', 'onAuth'],
  ['beforeAd', 'beforeAd'],
  ['afterAd', 'afterAd'],
  ['adBreakDone', 'adBreakDone'],
  ['beforeReward', 'beforeReward'],
  ['adViewed', 'adViewed'],
  ['adDismissed', 'adDismissed'],
  ['visibilitychange', 'visibilitychange pause'],
]) check(!all.includes(needle), `${what} missing`, `${what} in the bundle`);

if (!args.includes('--no-media')) {
  const M = 'submission-y8/media';
  const MB = 1024 * 1024;
  const imgs = [
    ...[1, 2, 3, 4].map((i) => [`screenshot-760x570-${i}.jpg`, 760, 570, 2 * MB]),
    ...[1, 2, 3, 4].map((i) => [`screenshot-1280x720-${i}.jpg`, 1280, 720, 5 * MB]),
    ['promo-landscape-1920x1080.jpg', 1920, 1080, 5 * MB],
    ['promo-portrait-1080x1920.jpg', 1080, 1920, 5 * MB],
    ['promo-card-760x570.jpg', 760, 570, 2 * MB],
  ];
  for (const [f, w, h, limit] of imgs) {
    const p = `${M}/${f}`;
    if (!existsSync(p)) {
      check(true, `${p} missing`, '');
      continue;
    }
    const [iw, ih, fmt] = await identify(p);
    const size = statSync(p).size;
    check(iw !== w || ih !== h || fmt !== 'JPEG' || size >= limit, `${p}: ${iw}x${ih} ${fmt}, ${size} bytes (want ${w}x${h} JPEG < ${limit / MB} MB)`, `${p}: ${w}x${h} JPEG, ${(size / 1024).toFixed(0)} KB`);
  }
  for (const [f, w, h] of [['gameplay-1280x720.mp4', 1280, 720], ['gameplay-960x720.mp4', 960, 720]]) {
    const p = `${M}/${f}`;
    if (!existsSync(p)) {
      check(true, `${p} missing`, '');
      continue;
    }
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', p], { encoding: 'utf8' }));
    const v = probe.streams.find((s) => s.codec_type === 'video');
    const dur = +probe.format.duration;
    const size = statSync(p).size;
    const ok = v && v.codec_name === 'h264' && v.width === w && v.height === h && dur >= 20 && dur <= 30 && size < 50 * MB && /mp4/.test(probe.format.format_name);
    check(!ok, `${p}: ${v?.codec_name} ${v?.width}x${v?.height}, ${dur}s, ${size} bytes (want H.264 MP4 ${w}x${h}, 20–30 s, < 50 MB)`, `${p}: H.264 MP4 ${w}x${h}, ${dur.toFixed(1)} s, ${(size / MB).toFixed(1)} MB`);
  }
}
done();
