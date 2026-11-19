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
  ['עד מתי צריך להגיש את החיבור באנגלית', 'get_assignments', ['מתי מגישים את החיבור?', 'החיבור באנגלית עד מתי', 'הגשתי את החיבור?', 'מה עם החיבור', 'יש לי חיבור להגיש?', 'החיבורים שלי'], ['איך כותבים את החיבור?', 'החיבור קשה לי', 'תכתבי לי את החיבור']],
  ['מה פרסמו בקלאסרום?', 'get_announcements', ['מה פרסמה המורה', 'פרסמו משהו חדש בקלאסרום?', 'מה פורסם היום'], ['למה לא פרסמו את הציונים?']],
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
E.rememberMiss(noa, 'מה פרסמו בקלאסרום?');
ok(!fast('מה פרסמו בקלאסרום').intent, 'after "not what I asked": the phrasing goes to Gemini again');
ok(!fast('מה פרסמה המורה בקלאסרום').intent, '… and so do variants that relied on the unlearned words');
// timing
const t0 = performance.now(); for (let i = 0; i < 200; i++) fast('כמה קיבלתי במבחן על המהפכה הצרפתית?'); const per = (performance.now() - t0) / 200;
ok(per < 2, `routing takes ${per.toFixed(2)} ms per question`);
console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
