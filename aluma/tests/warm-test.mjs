// Warm phrasing (js/warm.js) with a mocked Gemini: names never reach the model, invented numbers or
// names are refused, a slow model falls back to the plain answer. Usage: node aluma/tests/warm-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const W = await import('../js/warm.js');
const E = await import('../js/engine.js');
const { buildContext } = await import('../js/auth.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const fast = (uid, q) => { const c = buildContext(uid), r = E.routeQuestion(c, q); return { c, res: E.answer(c, q, { activeStudentId: c.allowedStudentIds[0], intent: r.intent, routed: r.t }) }; };

// 1. a parent's question: the child's name is replaced by a token before the call, and restored after
const { c: avi, res: dana } = fast('u-avi', 'מה הציונים של דנה?');
let sent = '';
const echo = async (prompt) => { sent = prompt; const t = (prompt.match(/\[\[[A-Z]\]\]/) || [''])[0]; const n = (prompt.match(/\b\d{2,3}\b/) || ['85'])[0]; return { text: `${t} עובדת יפה – הציון האחרון שלה ${n}, כל הכבוד!` }; };
const warm1 = await W.polish(avi, 'מה הציונים של דנה?', dana, { gen: echo });
ok(!/דנה|כהן|אבי/.test(sent), 'no real name in what is sent to the model');
ok(warm1 && warm1.includes('דנה'), 'the name comes back in the wording: ' + warm1);

// 2. an invented number is refused → the plain answer stays
const { c: noa, res: grades } = fast('u-noa', 'מה הציון שלי במתמטיקה?');
ok(await W.polish(noa, 'q', grades, { gen: async () => ({ text: 'קיבלת 1234 – מדהים!' }) }) === null, 'invented number → keep the plain answer');
// 3. a token that was never sent is refused
ok(await W.polish(noa, 'q', grades, { gen: async () => ({ text: '[[Q]] שמח בשבילך!' }) }) === null, 'made-up name token → refused');
// 4. a link or a list is refused; too long is refused
ok(await W.polish(noa, 'q', grades, { gen: async () => ({ text: 'ראי https://x.example' }) }) === null, 'link → refused');
ok(await W.polish(noa, 'q', grades, { gen: async () => ({ text: 'א'.repeat(400) }) }) === null, 'too long → refused');
// 5. slow model → null within the deadline
const t0 = Date.now();
ok(await W.polish(noa, 'q', grades, { gen: () => new Promise(() => {}), deadlineMs: 300 }) === null && Date.now() - t0 < 1000, 'slow model → plain answer after the deadline');
// 6. a model error → null
ok(await W.polish(noa, 'q', grades, { gen: async () => { throw new Error('429'); } }) === null, 'model error → plain answer');
// 7. good wording with the answer's own numbers is accepted
const num = (W.factsOf(grades).match(/\b\d{2,3}\b/) || [])[0];
const good = await W.polish(noa, 'q', grades, { gen: async () => ({ text: `יפה מאוד! ${num} במבחן האחרון – רואים שהשקעת.` }) });
ok(good && good.includes(num), 'wording that uses the real numbers is accepted: ' + good);
// 8. dates written the human way pass
const { c: n2, res: asg } = fast('u-noa', 'מה צריך להגיש השבוע?');
const f = W.factsOf(asg); const d = (f.match(/\b\d{1,2}\.\d{1,2}\b/) || [])[0];
ok(!d || (await W.polish(n2, 'q', asg, { gen: async () => ({ text: `יש לך כמה דברים להגיש – הראשון עד ${d}. את יכולה!` }) })) !== null, 'a due date written as day.month passes');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
