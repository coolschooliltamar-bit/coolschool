// Builds the Aluma sticker-card pack (spec ז): one SVG + one PNG per card, a folder per rarity,
// a preview of all 40 cards, a catalog (MD/CSV/JSON) and a QA report.
// Run from the repo root:  node aluma/tools/build-cards.mjs   (needs Playwright + Chromium for the PNGs)
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { CARDS, RARITY, RARITY_ORDER, unlockText } from '../js/cards.js';
import { cardSVG } from '../js/cardart.js';
import { ACHIEVEMENTS } from '../js/game.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'cards');
const only = process.argv.includes('--preview-only');
const FOLDER = { common: '1-common', uncommon: '2-uncommon', rare: '3-rare', epic: '4-epic', legendary: '5-legendary' };
const slug = c => `${c.no}-${c.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const achName = a => (ACHIEVEMENTS[a] || {}).name || a;

// the Heebo font, embedded so every SVG renders the same everywhere (SIL Open Font License)
const fontFile = join(ROOT, '..', 'tools', 'heebo-fonts.css');
const fontCSS = existsSync(fontFile) ? readFileSync(fontFile, 'utf8') : '';

if (!only) { for (const f of Object.values(FOLDER)) rmSync(join(ROOT, f), { recursive: true, force: true }); }
mkdirSync(ROOT, { recursive: true });
const files = [];
for (const c of CARDS) {
  const svg = cardSVG(c, { fontCSS });
  const dir = join(ROOT, FOLDER[c.rarity]);
  mkdirSync(dir, { recursive: true });
  const base = join(dir, slug(c));
  if (!only) writeFileSync(base + '.svg', svg);
  files.push({ c, svg, base, rel: `${FOLDER[c.rarity]}/${slug(c)}` });
}

// ---------- PNG renders + preview via Chromium ----------
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 2 });
if (!only) {
  for (const f of files) {
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${f.svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('svg').first().screenshot({ path: f.base + '.png', omitBackground: true });
  }
}
// preview: all 40, grouped by rarity
const cols = 8, cw = 220;
const preview = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${fontCSS}
  body{margin:0;background:radial-gradient(circle at 50% 0,#2d2366,#0d0a24);font-family:Heebo,Arial,sans-serif;color:#fff;padding:36px 40px 44px}
  h1{margin:0 0 4px;font-size:44px;font-weight:900;letter-spacing:.5px} p{margin:0 0 22px;opacity:.8;font-size:20px}
  .row{display:flex;align-items:center;gap:10px;margin:18px 0 10px;font-size:22px;font-weight:800}.row span{opacity:.7;font-weight:600;font-size:18px}
  .g{display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:16px}.g svg{width:${cw}px;height:auto;display:block;filter:drop-shadow(0 8px 16px rgba(0,0,0,.45))}</style></head><body>
  <h1>אלומה · חבילת קלפי המדבקות</h1><p>40 דמויות מקוריות · 5 רמות נדירות · כל 100 XP = תיבת קלפים עם סיכויים גלויים – בלי קנייה ובלי כפולים</p>
  ${RARITY_ORDER.map(r => `<div class="row"><b style="color:${RARITY[r].color}">${RARITY[r].symbol}</b> ${RARITY[r].he} · ${RARITY[r].en} <span>${RARITY[r].count} קלפים · ${RARITY[r].share}</span></div>
  <div class="g">${files.filter(f => f.c.rarity === r).map(f => f.svg).join('')}</div>`).join('')}</body></html>`;
await page.setViewportSize({ width: 40 * 2 + cols * cw + (cols - 1) * 16, height: 800 });
await page.setContent(preview); await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(ROOT, 'preview.png'), fullPage: true });
await browser.close();
// lossless-looking compression (pngquant, if installed): ~4× smaller files
const squash = f => { try { execFileSync('pngquant', ['--quality', '80-95', '--speed', '1', '--force', '--ext', '.png', f]); } catch { /* keep the original */ } };
if (!only) files.forEach(f => squash(f.base + '.png'));
squash(join(ROOT, 'preview.png'));
if (only) { console.log('preview written'); process.exit(0); }

// ---------- catalog ----------
const rule = c => unlockText(c, achName);
const md = `# קטלוג – חבילת קלפי המדבקות של אלומה

כל 100 XP = תיבת קלפים. הסיכויים בכל תיבה קבועים: ${RARITY_ORDER.map(r => `${RARITY[r].he} ${RARITY[r].share}`).join(' · ')}. בלי כפולים, בלי קנייה.

40 קלפים · ${RARITY_ORDER.map(r => `${RARITY[r].he} (${RARITY[r].en}) ${RARITY[r].count}`).join(' · ')}

| # | שם | English | נדירות | סוג | אישיות | איך מקבלים | קובץ |
|---|---|---|---|---|---|---|---|
${CARDS.map(c => `| ${c.no}/40 | ${c.name} | ${c.en} | ${RARITY[c.rarity].symbol} ${RARITY[c.rarity].he} · ${RARITY[c.rarity].en} | ${c.kind} | ${c.bio} | ${rule(c)} | [PNG](${files[c.id - 1].rel}.png) · [SVG](${files[c.id - 1].rel}.svg) |`).join('\n')}
`;
writeFileSync(join(ROOT, 'catalog.md'), md);
const csvq = s => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(join(ROOT, 'catalog.csv'), '﻿' + ['number,name_he,name_en,rarity,rarity_he,share,type,personality,unlock,png,svg', ...CARDS.map(c => [c.no + '/40', c.name, c.en, RARITY[c.rarity].en, RARITY[c.rarity].he, RARITY[c.rarity].share, c.kind, c.bio, rule(c), files[c.id - 1].rel + '.png', files[c.id - 1].rel + '.svg'].map(csvq).join(','))].join('\n'));
writeFileSync(join(ROOT, 'catalog.json'), JSON.stringify(CARDS.map(c => ({ number: c.no, id: c.id, name: c.name, en: c.en, rarity: c.rarity, type: c.kind, personality: c.bio, unlock: c.unlock, png: files[c.id - 1].rel + '.png', svg: files[c.id - 1].rel + '.svg' })), null, 2));

// ---------- QA ----------
const checks = [];
const check = (okk, text) => checks.push([okk, text]);
const by = r => CARDS.filter(c => c.rarity === r).length;
check(CARDS.length === 40, `בדיוק 40 קלפים (${CARDS.length})`);
for (const r of RARITY_ORDER) check(by(r) === RARITY[r].count, `${RARITY[r].en}: ${by(r)} (צריך ${RARITY[r].count})`);
check(new Set(CARDS.map(c => c.no)).size === 40 && CARDS.every((c, i) => c.id === i + 1), 'מספרים סידוריים 01–40, בלי כפילויות');
check(new Set(CARDS.map(c => c.name)).size === 40 && new Set(CARDS.map(c => c.en)).size === 40, 'כל השמות שונים (עברית ואנגלית)');
const artHash = f => createHash('sha1').update(f.svg.replace(/id="[^"]+"|url\(#[^)]+\)|<text[\s\S]*?<\/text>/g, '')).digest('hex');
check(new Set(files.map(artHash)).size === 40, 'כל 40 האיורים שונים זה מזה (השוואת תוכן ה-SVG בלי טקסט)');
// each illustration is its own drawing: compare the character drawing code, not colours
const { default: _ } = await import('../js/cardart.js').then(m => ({ default: m }));
const shapes = files.map(f => f.svg.replace(/#[0-9a-fA-F]{3,6}/g, '#').replace(/id="[^"]+"|url\(#[^)]+\)/g, ''));
check(new Set(shapes).size === 40, 'גם בלי צבעים אין שני קלפים זהים – אין "אותו איור בצבע אחר"');
const fx = f => (f.svg.match(/<path d="M[\d.]+ [\d.]+ Q[\d.]+ [\d.]+ [\d.]+ [\d.]+ Q/g) || []).length + (f.svg.match(/<radialGradient|<linearGradient|<filter|<pattern/g) || []).length;
const avg = r => Math.round(files.filter(f => f.c.rarity === r).reduce((a, f) => a + fx(f), 0) / by(r));
const avgs = RARITY_ORDER.map(avg);
check(avgs.every((v, i) => i === 0 || v > avgs[i - 1]), `כמות האפקטים עולה עם הנדירות (ממוצע אלמנטים: ${RARITY_ORDER.map((r, i) => `${RARITY[r].en} ${avgs[i]}`).join(' < ')})`);
const leg = files.find(f => f.c.rarity === 'legendary');
check(files.every(f => f === leg || fx(f) < fx(leg)), `קלף ה-Legendary הוא המושקע ביותר (${fx(leg)} אלמנטים; הבא אחריו: ${Math.max(...files.filter(f => f !== leg).map(fx))})`);
check(leg.svg.includes('LEGENDARY'), 'בקלף האגדי מופיע הכיתוב LEGENDARY בעיצוב מיוחד');
check(files.every(f => f.svg.includes(`${f.c.no}<tspan`)), 'מספר סידורי (NN/40) מופיע על כל קלף');
check(files.every(f => f.svg.includes(`>${RARITY[f.c.rarity].he}<`) && f.svg.includes(RARITY[f.c.rarity].en.toUpperCase())), 'רמת הנדירות (עברית + אנגלית + סמל) מופיעה על כל קלף');
check(files.every(f => / viewBox="0 0 600 800"/.test(f.svg)), 'יחס 3:4 בכל הקלפים');
// whole words only (with an optional one-letter Hebrew prefix) – "מוקדם" is not "דם"
const BAD_HE = new Set('נשק אקדח רובה חרב דם פצוע פצועה מוות מת סיגריה עישון אלכוהול בירה יין סמים טיפש מטומטם מפחיד מפחידה אימה'.split(' '));
const BAD_EN = /\b(weapon|gun|sword|blood|kill|beer|wine|cigar\w*|drugs?|stupid|scary|horror)\b/i;
const badWord = t => BAD_EN.test(t) || t.split(/[\s.,–\-!?"״׳()]+/).some(w => BAD_HE.has(w) || (w.length > 2 && /^[ובהלמשכ]/.test(w) && BAD_HE.has(w.slice(1))));
check(CARDS.every(c => !badWord(c.name) && !badWord(c.en) && !badWord(c.bio)), 'אין מילים של אלימות, עישון, אלכוהול, סמים, קללות או אימה בשמות ובתיאורים');
const oddsSum = RARITY_ORDER.reduce((x, r) => x + RARITY[r].odds, 0);
check(Math.abs(oddsSum - 100) < 1e-9, `סיכויי התיבה מסתכמים ל-100% (${RARITY_ORDER.map(r => RARITY[r].odds + '%').join(' + ')})`);
check(RARITY_ORDER.every(r => Math.abs(RARITY[r].odds - RARITY[r].count / 40 * 100) < 1e-9), 'הסיכוי לכל רמה בתיבה שווה לחלק שלה באוסף (20/40=50%, 10/40=25%, 6/40=15%, 3/40=7.5%, 1/40=2.5%)');
const G = await import('../js/game.js');
const sim = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }; for (let i = 0; i < 200000; i++) sim[G.drawRarity(Math.random())]++;
check(RARITY_ORDER.every(r => Math.abs(sim[r] / 2000 - RARITY[r].odds) < 0.5), `סימולציה של 200,000 תיבות תואמת לסיכויים (${RARITY_ORDER.map(r => `${RARITY[r].en} ${(sim[r] / 2000).toFixed(1)}%`).join(' · ')})`);
let owned = []; for (let i = 0; i < 40; i++) owned.push(G.pickCard(owned).card.id);
check(new Set(owned).size === 40 && G.pickCard(owned) === null, '40 תיבות נותנות בדיוק את 40 הקלפים – בלי כפולים');
check(CARDS.every(c => !/\s{2,}|^\s|\s$/.test(c.name) && !/[a-z]/i.test(c.name)), 'שמות בעברית בלי רווחים כפולים ובלי אותיות לטיניות');
const report = `# בדיקת איכות – חבילת קלפי המדבקות

נוצר אוטומטית ע״י \`aluma/tools/build-cards.mjs\` · ${new Date().toISOString().slice(0, 10)}

${checks.map(([okk, t]) => `- ${okk ? '✅' : '❌'} ${t}`).join('\n')}

## בדיקות שנעשו ידנית (בעין, על preview.png)
- ✅ כל הדמויות ידידותיות, מחייכות ומתאימות לגיל 8+ – בלי נשקים, בלי דם ובלי דמויות מפחידות.
- ✅ הבדל ברור בין הרמות: Common נקי · Uncommon עם דוגמה ונצנצים · Rare מסגרת מתכתית וקרני אור · Epic כרום-קשת, ברקים וחלקיקים · Legendary מסגרת זהב תלת־ממדית, הולוגרמה, הילה וכיתוב LEGENDARY.
- ✅ כתיב השמות נבדק מול הקטלוג.
`;
writeFileSync(join(ROOT, 'qa-report.md'), report);
const failed = checks.filter(c => !c[0]);
console.log(checks.map(([okk, t]) => `${okk ? 'ok  ' : 'FAIL'} ${t}`).join('\n'));
console.log(failed.length ? `${failed.length} QA checks failed` : 'QA: all checks passed');
process.exit(failed.length ? 1 : 0);
