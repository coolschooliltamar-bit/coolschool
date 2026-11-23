// The 1,000-card collection: counts match the published odds, every card renders, names are unique,
// art is deterministic and box draws follow the odds. Usage: node aluma/tests/cards-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const { CARDS, RARITY, TOTAL, SERIES, cardById } = await import('../js/cards.js');
const { cardSVG, cardArt } = await import('../js/cardart.js');
const G = await import('../js/game.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
ok(TOTAL === 1000 && CARDS.length === 1000, `1000 cards (${CARDS.length})`);
ok(CARDS.every((c, i) => c.id === i + 1 && cardById(c.id) === c), 'ids 1..1000 in order');
for (const [k, r] of Object.entries(RARITY)) { const n = CARDS.filter(c => c.rarity === k).length; ok(n === r.count && Math.abs(n / TOTAL * 100 - r.odds) < 1e-9, `${k}: ${n} cards = ${r.odds}% odds`); }
ok(SERIES.length === 25 && SERIES.every(s => CARDS.filter(c => c.world === s.id).length === 40), '25 series × 40 cards');
ok(new Set(CARDS.map(c => c.name)).size === 1000, 'all names unique');
let bad = []; const t0 = Date.now();
for (const c of CARDS) { try { const s = cardSVG(c, { w: 240 }); if (!s.startsWith('<svg') || /NaN|undefined/.test(s)) bad.push(c.id); if (!cardArt(c)) bad.push(c.id); } catch (e) { bad.push(`${c.id}: ${e.message}`); } }
ok(!bad.length, `every card renders without NaN/undefined (${Date.now() - t0} ms)${bad.length ? ' – ' + bad.slice(0, 5).join(', ') : ''}`);
const strip = s => s.replace(/id="[^"]+"|url\(#[^)]+\)|clip-path="[^"]+"/g, '');
ok(strip(cardSVG(cardById(500))) === strip(cardSVG(cardById(500))), 'the same card always looks the same');
let seed = 1; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const got = {}; for (let i = 0; i < 40000; i++) { const { card } = G.pickCard(R); got[card.rarity] = (got[card.rarity] || 0) + 1; }
ok(Object.entries(RARITY).every(([k, r]) => Math.abs(got[k] / 40000 * 100 - r.odds) < 1), `box draws follow the odds: ${Object.entries(got).map(([k, n]) => `${k} ${(n / 400).toFixed(1)}%`).join(', ')}`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
