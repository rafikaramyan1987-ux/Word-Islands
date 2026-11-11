#!/usr/bin/env node
// Y8 media (Studio → Media), all into submission-y8/media/, rendered from the real game:
//  - screenshot-760x570-{1..4}.jpg (Standard Screenshot, 4:3) and screenshot-1280x720-{1..4}.jpg (Widescreen
//    Screenshot, 16:9): four real gameplay moments, each rendered natively at both sizes (no menus)
//  - promo-landscape-1920x1080.jpg, promo-portrait-1080x1920.jpg, promo-card-760x570.jpg: the cover scene + logo
//  - gameplay-1280x720.mp4 and gameplay-960x720.mp4: the same scripted take of real play (26 s, no sound), rendered
//    at 16:9 and at 4:3 so the board stays in frame; the island restored + the sail at about 9–15 s
//   npm run build:web && npx vite preview --outDir dist/web --port 4173 &  node tools/y8/media.mjs [shots,promos,video]
import fs from 'node:fs';
import { cover, gameplay, gameplayVideo, launch } from '../lib/portal-media.mjs';

const OUT = 'submission-y8/media';
const MB = 1024 * 1024;
fs.mkdirSync(OUT, { recursive: true });
const only = (process.argv[2] ?? 'shots,promos,video').split(',');
const SHOTS = [
  { level: 25, leave: 2 }, // Windmill Meadows, level 26: a crossword half solved
  { level: 9, complete: true }, // Sunny Lagoon, level 10: the island restored
  { level: 40, leave: 2 }, // Sunset Dunes, level 41
  { level: 76, leave: 1 }, // Blossom Isle, level 77
];
const browser = await launch();
if (only.includes('shots'))
  for (const [i, s] of SHOTS.entries()) {
    await gameplay(browser, `${OUT}/screenshot-760x570-${i + 1}.jpg`, 760, 570, s.level, { ...s, limit: 2 * MB });
    await gameplay(browser, `${OUT}/screenshot-1280x720-${i + 1}.jpg`, 1280, 720, s.level, { ...s, limit: 5 * MB });
  }
if (only.includes('promos')) {
  await cover(browser, `${OUT}/promo-landscape-1920x1080.jpg`, 1920, 1080, { logo: true, island: 0, render: 1, limit: 5 * MB });
  await cover(browser, `${OUT}/promo-portrait-1080x1920.jpg`, 1080, 1920, { logo: true, island: 6, render: 1, limit: 5 * MB });
  await cover(browser, `${OUT}/promo-card-760x570.jpg`, 760, 570, { logo: true, island: 1, render: 2, limit: 2 * MB });
}
if (only.includes('video')) {
  await gameplayVideo(browser, `${OUT}/gameplay-1280x720.mp4`, 1280, 720);
  await gameplayVideo(browser, `${OUT}/gameplay-960x720.mp4`, 960, 720);
}
await browser.close();
