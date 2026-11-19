// Real Google Classroom accounts: courses are often named in English ("History 9B"), the calendar may be off.
// Usage: node aluma/tests/live-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const G = await import('../js/google.js');
const E = await import('../js/engine.js');
const now = new Date().toISOString();
Object.assign(G.LIVE, { fetchedAt: now, courses: [{ id: '1', name: 'History 9B', role: 'student' }, { id: '2', name: 'מתמטיקה ט׳2', role: 'student' }],
  assignments: [{ id: 'a1', subject: 'History 9B', title: 'Essay on the revolution', due: new Date(Date.now() + 2 * 864e5).toISOString(), status: 'open', source: 'Google Classroom', link: '#' }],
  grades: [{ id: 'g1', subject: 'מתמטיקה ט׳2', type: 'assignment', title: 'שיעורי בית 3', score: 9, max: 10, date: now }], announcements: [], teachers: [], events: null, errors: [] });
const ctx = { userId: 'g-1', role: 'student', live: true, user: { id: 'g-1', name: 'Test User' }, allowedStudentIds: ['g-1'], classIds: [], scopes: { grades: true, assignments: true, schedule: true, attendance: true, messages: true, send: true } };
let bad = 0;
const check = (q, intent, must, mustNot) => {
  const r = E.routeQuestion(ctx, q); const a = r.intent ? E.answer(ctx, q, { activeStudentId: 'g-1', intent: r.intent, routed: r.t }).text : '';
  const ok = r.intent === intent && (!must || a.includes(must)) && (!mustNot || !a.includes(mustNot));
  if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', q, '→', r.intent || r.why, '|', a.slice(0, 90));
};
check('מה יש לי להגיש בהיסטוריה?', 'assignments', 'History 9B', 'אין לך היסטוריה');      // Hebrew subject ↔ English course name
check('יש לי מטלות ב-History?', 'assignments', 'מטלה אחת');                              // case-insensitive, singular
check('מה הציון שלי במתמטיקה', 'grades', '9');
check('כמה קיבלתי בכימיה', 'grades', 'לא מצאתי ב-Classroom כיתה של כימיה');              // honest wording for live accounts
check('מה יש לי מחר?', 'not_connected', 'Calendar');                                      // no calendar → instant answer, no Gemini
check('כמה היעדרויות יש לי', 'not_connected', 'משוב');
console.log(bad ? `${bad} FAILED` : 'ALL PASSED'); process.exit(bad ? 1 : 0);
