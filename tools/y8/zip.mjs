#!/usr/bin/env node
// Y8 upload (Builds tab): zips dist-y8/ (run `npm run build:y8` first) so that index.html and the game
// files sit at the zip root, relative paths only (a single-player game is uploaded to Y8 directly, not iframe-hosted),
// then runs the static checks (tools/y8/check.mjs).
// Usage: node tools/y8/zip.mjs [out.zip]   (default submission-y8/word-islands-y8-v1.zip)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'submission-y8/word-islands-y8-v1.zip');
const dist = resolve('dist-y8');
if (!existsSync(`${dist}/index.html`)) throw new Error('dist-y8/index.html missing: run `npm run build:y8` first');
mkdirSync(dirname(out), { recursive: true });
rmSync(out, { force: true });
// the folder's *contents* (cwd = dist): index.html at the root; -X: no extra attributes, -D: no directory entries
execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
execFileSync(process.execPath, ['tools/y8/check.mjs', out, ...process.argv.slice(3)], { stdio: 'inherit' });
