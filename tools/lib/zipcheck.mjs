/** shared helpers for the GameMonetize / Y8 zip checks (tools/gamemonetize/check.mjs, tools/y8/check.mjs) */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function checker() {
  const errors = [];
  const check = (bad, badMsg, okMsg) => {
    if (bad) {
      errors.push(badMsg);
      console.log(`  ✗ ${badMsg}`);
    } else console.log(`  ✓ ${okMsg}`);
  };
  const done = () => {
    if (errors.length) {
      console.log(`\nFAILED: ${errors.length} problem(s)`);
      process.exit(1);
    }
    console.log('\nOK');
  };
  return { check, done };
}

/** unzip into a temp dir: entries, text files ([path, content]) and the index.html (or null) */
export function readZip(zip, check) {
  console.log(`zip: ${zip} (${(statSync(zip).size / 1024).toFixed(0)} KB)`);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
  check(!entries.includes('index.html'), 'index.html is not at the zip root', 'index.html at the zip root');
  const unsafe = entries.filter((e) => e.startsWith('/') || e.split('/').includes('..') || e.includes('\\'));
  check(unsafe.length, `unsafe paths in the zip: ${unsafe.join(', ')}`, `${entries.length} files, all relative`);
  check(statSync(zip).size >= 50 * 1024 * 1024, 'zip is 50 MB or more', 'zip under 50 MB');
  const dir = mkdtempSync(join(tmpdir(), 'portalzip-'));
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const files = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
  walk(dir);
  const text = files.filter((f) => /\.(html|js|css|json|mjs)$/.test(f)).map((f) => [f.slice(dir.length + 1), readFileSync(f, 'utf8')]);
  const html = existsSync(join(dir, 'index.html')) ? readFileSync(join(dir, 'index.html'), 'utf8') : null;
  rmSync(dir, { recursive: true, force: true });
  return { entries, files: files.map((f) => f.slice(dir.length + 1)), text, all: text.map(([, s]) => s).join('\n'), html };
}

/** every http(s) URL in the text, except XML namespaces (data, not requests) */
export const urlsIn = (all) => [...new Set(all.match(/https?:\/\/[A-Za-z0-9.\-_/]+/g) ?? [])].filter((u) => !/^https?:\/\/www\.w3\.org\//.test(u));

/** index.html's src/href references that are not relative (other than `allow`) */
export const nonRelative = (html, allow = []) =>
  [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]).filter((r) => !allow.includes(r) && !r.startsWith('./') && !r.startsWith('data:') && !r.startsWith('#'));

/** [width, height, format] of an image (ImageMagick identify) */
export const identify = (p) => {
  const [w, h, f] = execFileSync('identify', ['-format', '%w %h %m', p], { encoding: 'utf8' }).trim().split(' ');
  return [+w, +h, f];
};
