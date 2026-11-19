// Runs the generated question bank through the router + fast engine and hunts for bugs automatically.
// Usage: node aluma/tests/bank-test.mjs [train|test|all] [--show N]
// Checks on every FAST answer (bug oracles):
//   · no crash, no "I didn't understand" / "something went wrong"
//   · a subject in the question → the answer is about that subject (its name appears, or "you don't have X")
//   · a parent asking about one child → that child's name appears and the other child's does not
//   · routing takes < 5 ms
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const { routeQuestion, answer, OTHER_SUBJECTS } = await import('../js/engine.js');
const { buildContext } = await import('../js/auth.js');
const { generate } = await import('./question-bank.mjs');
const { subjectName } = await import('../js/data.js');
const split = ['train', 'test', 'all'].find(a => process.argv.includes(a)) || 'test';
const show = process.argv.includes('--show') ? +process.argv[process.argv.indexOf('--show') + 1] : 12;
const bank = generate({ split });
const ctxs = {}; const ctxOf = uid => (ctxs[uid] = ctxs[uid] || buildContext(uid));
const NAMES = { history: ['היסטוריה'], math: ['מתמטיקה'], english: ['אנגלית'], science: ['מדעים'], literature: ['ספרות'], hebrew: ['לשון'], bible: ['תנ״ך'], pe: ['חינוך גופני'] };
const stats = { n: 0, ok: 0, fastWanted: 0, fastGot: 0, wrongFast: 0, missedFast: 0, wrongTopic: 0, oracle: 0, slow: 0 };
const fails = {};
const fail = (kind, row, msg) => { (fails[kind] = fails[kind] || []).push(`${row.uid.padEnd(7)} [${row.topic}] ${row.q}  →  ${msg}`); };
for (const row of bank) {
  stats.n++;
  const ctx = ctxOf(row.uid);
  const t0 = performance.now(); let r;
  try { r = routeQuestion(ctx, row.q); } catch (e) { fail('crash', row, e.message); continue; }
  if (performance.now() - t0 > 5) stats.slow++;
  if (row.topic === 'ai') { if (r.intent) { stats.wrongFast++; fail('fast answer to an AI question', row, r.intent); } else stats.ok++; continue; }
  stats.fastWanted++;
  if (!r.intent) { stats.missedFast++; fail('went to Gemini', row, r.why); continue; }
  if (r.intent !== row.topic) { stats.wrongTopic++; fail('wrong topic', row, r.intent); continue; }
  let a;
  try { a = answer(ctx, row.q, { activeStudentId: ctx.allowedStudentIds[0], intent: r.intent, routed: r.t }); } catch (e) { fail('crash', row, e.stack.split('\n')[0]); continue; }
  const text = a.text + ' ' + (a.cards || []).map(c => [c.title, c.label, c.subject && (NAMES[c.subject] || [c.subject])[0], ...(c.rows || []).flat()].filter(Boolean).join(' ')).join(' ');
  let bad = '';
  if (/לא בטוחה שהבנתי|משהו השתבש/.test(text)) bad = 'did not understand';
  else if (row.subject && ['grades', 'average', 'assignments', 'teachers', 'schedule'].includes(row.topic) && !/(הכי|ביותר|כל המקצועות|מקצוע)/.test(row.q)) {
    const other = OTHER_SUBJECTS.find(o => o.aliases.includes(row.subject.n) || o.name === row.subject.n);
    const names = row.subject.id.startsWith('x:') ? [row.subject.n, ...(other ? [other.name] : [])] : NAMES[row.subject.id];
    if (!names.some(n => text.includes(n))) bad = `answer is not about ${names[0]}: ${a.text.slice(0, 80)}`;
  }
  if (!bad && row.kid) { const other = row.kid === 'דנה' ? 'יואב' : 'דנה'; if (!text.includes(row.kid)) bad = `child ${row.kid} not named: ${a.text.slice(0, 70)}`; else if (text.includes(other) && !/(שניהם|הילדים)/.test(row.q)) bad = `answer also mentions ${other}`; }
  if (bad) { stats.oracle++; fail('bad fast answer', row, bad); continue; }
  stats.fastGot++; stats.ok++;
}
for (const [k, list] of Object.entries(fails)) { console.log(`\n== ${k} (${list.length})`); list.slice(0, show).forEach(x => console.log('  ' + x.slice(0, 200))); }
console.log(`\n[${split}] ${bank.length} questions · correct ${stats.ok}/${stats.n} (${(stats.ok / stats.n * 100).toFixed(1)}%) · fast coverage ${stats.fastGot}/${stats.fastWanted} (${(stats.fastGot / stats.fastWanted * 100).toFixed(1)}%)` +
  ` · wrong fast on AI questions: ${stats.wrongFast} · wrong topic: ${stats.wrongTopic} · bad fast answers: ${stats.oracle} · slow: ${stats.slow}`);
process.exitCode = stats.wrongFast + stats.wrongTopic + stats.oracle + (fails.crash || []).length ? 1 : 0;
