#!/usr/bin/env node
// CI check for the GameDistribution build: the game ID must be either the documented placeholder
// (warning, until the real ID is provided) or a valid 32-character hex game hash; the built bundle
// must contain the ID and the GD SDK URL.
import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER = 'GD_GAME_ID_PLACEHOLDER';
const id = process.env.VITE_GD_GAME_ID || PLACEHOLDER;
const dir = process.argv[2] ?? 'dist/gd';
let ok = true;
if (id === PLACEHOLDER) {
  console.log('::warning title=GameDistribution game ID::VITE_GD_GAME_ID is not set; the gd build uses the placeholder. Set the repository variable VITE_GD_GAME_ID before submitting.');
} else if (!/^[0-9a-f]{32}$/.test(id)) {
  console.error(`VITE_GD_GAME_ID "${id}" is not a 32-character lowercase hex game hash`);
  ok = false;
}
const js = fs.readdirSync(path.join(dir, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8')).join('\n');
if (!js.includes(id)) { console.error(`gd build does not contain the game ID ${id}`); ok = false; }
if (!js.includes('html5.api.gamedistribution.com/main.min.js')) { console.error('gd build does not load the GameDistribution SDK'); ok = false; }
console.log(ok ? `gd build ok (game ID: ${id === PLACEHOLDER ? 'placeholder' : id})` : 'gd build check FAILED');
process.exit(ok ? 0 : 1);
