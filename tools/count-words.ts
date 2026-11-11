/** Word-list statistics. Usage: npx tsx tools/count-words.ts [lang ...] */
import { LANGS, type Lang } from '../src/core/alphabet';
import { loadDictionary } from './lib/dict';

const langs = (process.argv.slice(2).length ? process.argv.slice(2) : LANGS) as Lang[];
for (const lang of langs) {
  const d = loadDictionary(lang);
  const byLen: Record<number, number> = {};
  for (const w of d.words) byLen[w.length] = (byLen[w.length] ?? 0) + 1;
  console.log(`${lang}: ${d.words.size} words (${d.core.size} base forms, ${d.words.size - d.core.size} inflected), blocklist ${d.blocked.size}`);
  console.log(`  by length: ${Object.entries(byLen).map(([l, n]) => `${l}:${n}`).join(' ')}`);
  const rej = d.rejected.filter((r) => r.reason !== 'blocklisted');
  if (rej.length) console.log(`  rejected: ${rej.slice(0, 30).map((r) => `${r.raw} (${r.reason})`).join(', ')}${rej.length > 30 ? ' …' : ''}`);
  const bl = d.rejected.filter((r) => r.reason === 'blocklisted');
  if (bl.length) console.log(`  blocklisted words present in list (dropped): ${bl.map((r) => r.raw).join(', ')}`);
}
