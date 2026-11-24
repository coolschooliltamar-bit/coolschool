// Lesson explanations (js/intro.js): parsing, the local fallback, YouTube links, and that a teacher's class
// path is a draft until published. Usage: node aluma/tests/intro-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const I = await import('../js/intro.js');
const L = await import('../js/learn.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

ok(I.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10') === 'dQw4w9WgXcQ', 'watch link');
ok(I.youtubeId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'short link');
ok(I.youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'shorts link');
ok(I.youtubeId('https://example.com/watch?v=dQw4w9WgXcQ') === null, 'another site is refused');

const v = I.validIntro({ short: ' <b>היום</b> נלמד שברים ', examples: ['½ + ½ = 1', '', 'x'.repeat(900)], more: 'עוד' });
ok(v && !/[<>]/.test(v.short) && v.examples.length === 2 && v.examples[1].length <= 420, 'explanation is cleaned and trimmed');
ok(I.validIntro({ short: '', examples: [] }) === null, 'an empty explanation is refused');

const loc = I.localIntro('המהפכה הצרפתית', L.BANK.history.units[0].qs);
ok(loc.local && loc.facts && loc.short.includes('המהפכה הצרפתית') && loc.examples.length === 3, 'last fallback: the key facts of the lesson');
// every unit of the basic path has a ready, real explanation (no Gemini needed)
const { BANK_INTROS } = await import('../js/intro-bank.js');
const units = Object.entries(L.BANK).flatMap(([s, b]) => b.units.map((_, i) => `${s}:${i}`));
ok(units.every(k => BANK_INTROS[k] && BANK_INTROS[k].short.length > 120 && BANK_INTROS[k].examples.length === 2 && BANK_INTROS[k].more.length > 300), `all ${units.length} basic-path units have a full explanation`);
ok(units.every(k => I.cached(null, k.split(':')[0], +k.split(':')[1], 0) === BANK_INTROS[k]), 'the basic path uses the ready explanations');

// a path without Gemini: every lesson gets an explanation
const p = { id: 'tst', subject: 'history', lessonsPerUnit: 2, units: [{ title: 'א', qs: L.BANK.history.units[0].qs }, { title: 'ב', qs: L.BANK.history.units[1].qs }] };
await I.forPath(p);
ok(Object.keys(p.intros).length === 0 && p.introsMissing === 4, 'without Gemini nothing weak is stored – the lessons write theirs when opened');

// drafts are hidden from the class until published
L.savePath({ id: 'd1', ownerId: 'u-rina', classId: 'c1', draft: true, units: [], cards: [], createdAt: '2026-11-24' });
ok(!L.classPaths('c1').some(x => x.id === 'd1') && L.draftsBy('u-rina').some(x => x.id === 'd1'), 'a draft is not shown to the class');
L.publishPath('d1');
ok(L.classPaths('c1').some(x => x.id === 'd1') && !L.draftsBy('u-rina').length, 'after publishing the class sees it');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
