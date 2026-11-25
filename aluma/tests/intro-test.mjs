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

const v = I.validIntro({ text: ' <b>היום</b> נלמד שברים: חצי ועוד חצי הם שלם.\n\n\n  פסקה שנייה   עם רווחים ' });
ok(v && !/[<>]/.test(v.text) && I.paragraphs(v).length === 2 && I.paragraphs(v)[1] === 'פסקה שנייה עם רווחים', 'the text is cleaned and keeps its paragraphs');
ok(I.validIntro({ text: 'קצר' }) === null, 'a too-short text is refused');
const old = I.validIntro({ short: 'הסבר ישן על הנושא, מספיק ארוך כדי לעבור.', examples: ['דוגמה ראשונה'], more: 'עוד פרטים' });
ok(old && I.paragraphs(old).length === 3 && old.text.includes('לדוגמה: דוגמה ראשונה'), 'an explanation in the older format becomes one text');
const loc = I.localIntro('המהפכה הצרפתית', L.BANK.history.units[0].qs);
ok(loc.local && loc.text.includes('המהפכה הצרפתית') && I.paragraphs(loc).length >= 2, 'last fallback: the key facts of the lesson');
const units = Object.entries(L.BANK).flatMap(([s, b]) => b.units.flatMap((_, u) => [0, 1, 2].map(l => [s, u, l])));
ok(units.every(([s, u, l]) => { const it = I.cached(null, s, u, l); return it && I.paragraphs(it).length >= 2 && it.text.length > 200; }), `all ${units.length} basic-path lessons have their own explanatory text`);
ok(I.cached(null, 'history', 0, 0).text !== I.cached(null, 'history', 0, 1).text, 'each lesson of a unit has a different text');

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
