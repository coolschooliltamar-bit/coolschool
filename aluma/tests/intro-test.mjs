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

const v = I.validIntro({ short: ' <b>היום</b> נלמד שברים ', examples: ['½ + ½ = 1', '', 'x'.repeat(500)], more: 'עוד' });
ok(v && !/[<>]/.test(v.short) && v.examples.length === 2 && v.examples[1].length <= 240, 'explanation is cleaned and trimmed');
ok(I.validIntro({ short: '', examples: [] }) === null, 'an empty explanation is refused');

const loc = I.localIntro('המהפכה הצרפתית', L.BANK.history.units[0].qs);
ok(loc.local && loc.short.includes('המהפכה הצרפתית') && loc.examples.length === 2 && loc.more.length > 10, 'local fallback: topic + examples + more');

// a path without Gemini: every lesson gets an explanation
const p = { id: 'tst', subject: 'history', lessonsPerUnit: 2, units: [{ title: 'א', qs: L.BANK.history.units[0].qs }, { title: 'ב', qs: L.BANK.history.units[1].qs }] };
await I.forPath(p);
ok(Object.keys(p.intros).length === 4 && ['0:0', '0:1', '1:0', '1:1'].every(k => p.intros[k].short), 'every lesson of the path has an explanation');

// drafts are hidden from the class until published
L.savePath({ id: 'd1', ownerId: 'u-rina', classId: 'c1', draft: true, units: [], cards: [], createdAt: '2026-11-24' });
ok(!L.classPaths('c1').some(x => x.id === 'd1') && L.draftsBy('u-rina').some(x => x.id === 'd1'), 'a draft is not shown to the class');
L.publishPath('d1');
ok(L.classPaths('c1').some(x => x.id === 'd1') && !L.draftsBy('u-rina').length, 'after publishing the class sees it');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
