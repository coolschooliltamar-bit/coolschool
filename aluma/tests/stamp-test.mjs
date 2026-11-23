// version.json must match the site's files (run node aluma/tools/stamp.mjs before committing).
import { readFileSync } from 'node:fs';
const { stamp } = await import('../tools/stamp.mjs');
const cur = JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8'));
const now = stamp();
const ok = cur.v === now.v && cur.files.join() === now.files.join();
console.log(ok ? `ok   version.json is up to date (${now.v})\nALL PASSED` : `FAIL version.json is stale: run node aluma/tools/stamp.mjs (${cur.v} → ${now.v})`);
process.exitCode = ok ? 0 : 1;
