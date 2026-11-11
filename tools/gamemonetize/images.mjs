#!/usr/bin/env node
// GameMonetize thumbnails: the cover / title scene (a fully restored Sunny Lagoon island in the sunny sea, as on
// the other portals' covers) WITHOUT the logo or letter tiles: no text, no logo (GameMonetize rule). Rendered at 2x,
// downscaled, JPEG under 300 KB.
//   npm run build:web && npx vite preview --outDir dist/web --port 4173 &  node tools/gamemonetize/images.mjs
// Out: submission-gamemonetize/word-islands-{512x384,512x512,512x340}.jpg
import fs from 'node:fs';
import { cover, launch } from '../lib/portal-media.mjs';

const OUT = 'submission-gamemonetize';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const [w, h] of [[512, 384], [512, 512], [512, 340]]) await cover(browser, `${OUT}/word-islands-${w}x${h}.jpg`, w, h, { logo: false, limit: 300 * 1024 });
await browser.close();
