#!/usr/bin/env node
// Fails if a build folder is larger than the 10 MB budget.
import fs from 'node:fs';
import path from 'node:path';

const LIMIT = 10 * 1024 * 1024;
const dirs = process.argv.slice(2);
let failed = false;
function size(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((a, f) => a + size(path.join(p, f)), 0);
}
for (const d of dirs) {
  const s = size(d);
  const ok = s <= LIMIT;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${d}: ${(s / 1024 / 1024).toFixed(2)} MB (limit 10 MB)`);
}
process.exit(failed ? 1 : 0);
