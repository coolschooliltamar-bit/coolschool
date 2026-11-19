// Does the router's learning GENERALISE? Teach one question (as if Gemini answered it with one data tool),
// then ask paraphrases. Also: unsafe questions must never become "fast", and "not what I asked" unlearns.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const E = await import('../js/engine.js');
const { buildContext } = await import('../js/auth.js');
const noa = buildContext('u-noa');
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'FAIL', m); };
const fast = q => E.routeQuestion(noa, q);
const lessons = [
  ['עד מתי צריך להגיש את הרפרט באנגלית', 'get_assignments', ['מתי מגישים את הרפרט?', 'הרפרט באנגלית עד מתי', 'הגשתי את הרפרט?', 'מה עם הרפרט', 'יש לי רפרט להגיש?', 'הרפרטים שלי'], ['איך כותבים את הרפרט?', 'הרפרט קשה לי', 'תכתבי לי את הרפרט']],
  ['מה העלו לאתר הכיתה?', 'get_announcements', ['מה העלו המורים לאתר', 'העלו משהו חדש לאתר הכיתה?', 'מה העלו היום לאתר'], ['למה לא העלו את הציונים?']],
  ['מה הסטטוס של המטלות שלי', 'get_assignments', ['סטטוס מטלות', 'מה הסטטוס של העבודה בהיסטוריה'], ['מה הסטטוס שלי עם החברים']],
  ['מה רשום לי בתעודה במתמטיקה', 'get_grades', ['מה רשום בתעודה באנגלית', 'התעודה שלי'], ['איך משפרים את התעודה']],
];
for (const [q, tool, paraphrases, unsafe] of lessons) {
  ok(!fast(q).intent, `before learning, Gemini answers: "${q}" (${fast(q).why})`);
  ok(E.learnFromModel(noa, q, [tool]), `learned from Gemini (${tool})`);
  for (const p of paraphrases) { const r = fast(p); ok(!!r.intent, `  paraphrase answered fast: "${p}" → ${r.intent || r.why}${r.via ? ' (' + r.via + ')' : ''}`); }
  for (const p of unsafe) { const r = fast(p); ok(!r.intent, `  still goes to Gemini: "${p}" (${r.why})`); }
}
ok(!E.learnFromModel(noa, 'הציון שלי לא הוגן', ['get_grades']), 'never learns a question with "לא" / "הוגן"');
ok(!E.learnFromModel(noa, 'מה הציונים שלי ואיך לשפר', ['get_grades']), 'never learns advice questions');
// "not what I asked" unlearns – for that phrasing and its close variants
E.rememberMiss(noa, 'מה העלו לאתר הכיתה?');
ok(!fast('מה העלו לאתר הכיתה').intent, 'after "not what I asked": the phrasing goes to Gemini again');
ok(!fast('מה העלו המורים לאתר').intent, '… and so do variants that relied on the unlearned words');
// ---------- shared learning (all users) ----------
const sent = []; E.setLearnSink(p => sent.push(p));
E.learnFromModel(noa, 'מה המצב של הפרויקטון בהיסטוריה', ['get_assignments']);       // "complex" word → nothing learned
E.learnFromModel(noa, 'מה רשום במחברת הציונים', ['get_grades']);
const words = sent.flatMap(p => p.keys);
ok(!E.routeQuestion(noa, 'מה עם החברים שלי').intent, 'learning "מחברת" does not make "החברים" (friends) a grades word');
ok(sent.length >= 1 && sent.every(p => p.vote === 1 && p.keys.length <= 12), `a lesson sends only topic + word stems (${JSON.stringify(sent.at(-1))})`);
ok(sent.every(p => !p.keys.some(k => / /.test(k))), 'no sentences are sent – single words only');
sent.length = 0; E.learnFromModel(noa, 'מה כתוב בתיק הבריאות שלי במחברת', ['get_grades']);
ok(!sent.flatMap(p => p.keys).some(k => k.includes('בריאות')), 'sensitive words (health…) are never shared');
sent.length = 0; E.learnFromModel(noa, 'מה הציון של נועה במחברת', ['get_grades']);
ok(!sent.flatMap(p => p.keys).some(k => k.includes('נועה')), 'names are never shared');
// words other users taught arrive from the server
const noa2 = buildContext('u-noa');
ok(!E.routeQuestion(noa2, 'מה כתוב בפנקס הציונים').intent, 'before: an unknown word goes to Gemini');
E.setSharedVocab({ grades: { 'פנקס': 1, '~פנקס': 1 }, evil: { 'x': 1 }, assignments: { '<script>': 1 } });
ok(E.routeQuestion(noa2, 'מה כתוב בפנקס הציונים').intent === 'grades', 'after: a word taught by other users is understood');
ok(E.sharedSize() === 1, 'unknown topics and malformed words from the server are ignored');
sent.length = 0; E.rememberMiss(noa2, 'מה כתוב בפנקס הציונים');
ok(!E.routeQuestion(noa2, 'מה כתוב בפנקס הציונים').intent, '"not what I asked" blocks the shared word for this user at once');
ok(sent.some(p => p.vote === -1 && p.keys.includes('פנקס')), '… and sends a vote against it');

// seed knowledge (trained from tests/teach-list.mjs) – a user's "not what I asked" blocks it for them
ok(fast('יש לי פרזנטציה להגיש?').intent === 'assignments', 'seed knowledge: "פרזנטציה" is an assignment');
E.rememberMiss(noa, 'יש לי פרזנטציה להגיש?');
ok(!fast('מתי הפרזנטציה').intent, '"not what I asked" blocks a seed word for this user');

// timing
const t0 = performance.now(); for (let i = 0; i < 200; i++) fast('כמה קיבלתי במבחן על המהפכה הצרפתית?'); const per = (performance.now() - t0) / 200;
ok(per < 2, `routing takes ${per.toFixed(2)} ms per question`);
console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
