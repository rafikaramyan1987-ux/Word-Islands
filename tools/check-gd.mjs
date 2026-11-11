#!/usr/bin/env node
// CI check for the GameDistribution build: the bundle must contain Word Islands' exact GameDistribution game ID,
// set GD_OPTIONS and load the GD SDK; it must not contain other portals' SDKs.
import fs from 'node:fs';
import path from 'node:path';

const GAME_ID = '53ecfdcc22b1483c86e809d8c324febe';
const dir = process.argv[2] ?? 'dist/gd';
const errors = [];
const src = fs.readFileSync('src/platform/gd.ts', 'utf8');
if (!src.includes(`'${GAME_ID}'`)) errors.push(`src/platform/gd.ts does not define the game ID ${GAME_ID}`);
const js = fs.readdirSync(path.join(dir, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8')).join('\n');
if (!js.includes(GAME_ID)) errors.push(`the gd bundle does not contain the game ID ${GAME_ID}`);
if (!js.includes('GD_OPTIONS')) errors.push('the gd bundle does not set GD_OPTIONS');
if (!js.includes('html5.api.gamedistribution.com/main.min.js')) errors.push('the gd bundle does not load the GameDistribution SDK');
for (const bad of ['crazygames-sdk', 'gamepix.sdk.js', 'playgama-bridge.js']) if (js.includes(bad)) errors.push(`the gd bundle contains another portal SDK (${bad})`);
if (errors.length) {
  console.error(`gd build check FAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`gd build ok (game ID ${GAME_ID})`);
