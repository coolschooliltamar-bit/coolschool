// Writes version.json: a hash of every file the site loads, and the list of those files.
// index.html checks it on every visit (never from cache); when it changed, the browser re-downloads
// the files (bypassing its cache) and reloads once – so an update reaches everyone right away.
// Run before every commit that changes the site:  node aluma/tools/stamp.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = dir => readdirSync(join(ROOT, dir)).filter(f => /\.(js|css|webp|png|jpg|ico|svg)$/.test(f)).sort().map(f => `${dir}/${f}`);
export const siteFiles = () => [...list('js'), ...list('css'), ...list('img')];
export function stamp() {
  const h = createHash('sha256');
  for (const f of siteFiles()) h.update(f).update(readFileSync(join(ROOT, f)));
  return { v: h.digest('hex').slice(0, 12), files: siteFiles() };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const s = stamp(); writeFileSync(join(ROOT, 'version.json'), JSON.stringify(s) + '\n'); console.log(`version ${s.v} · ${s.files.length} files`); }
