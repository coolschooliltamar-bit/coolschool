// Runs the question corpus through the fast-answer router and the local engine.
// Usage: node aluma/tests/router-test.mjs [--verbose]
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const { routeQuestion, answer } = await import('../js/engine.js');
const { buildContext } = await import('../js/auth.js');
const { CORPUS: C1 } = await import('./router-corpus.mjs'); const { HOLDOUT } = await import('./router-holdout.mjs'); const CORPUS = process.argv.includes('--holdout') ? HOLDOUT : C1;
const verbose = process.argv.includes('--verbose');
let n = 0, ok = 0, fastWanted = 0, fastGot = 0, wrongFast = 0;
const fails = [];
for (const [uid, rows] of Object.entries(CORPUS)) {
  const ctx = buildContext(uid);
  for (const [q, want, has] of rows) {
    n++;
    const t0 = performance.now(); const r = routeQuestion(ctx, q); const ms = performance.now() - t0;
    let good, ans = '';
    if (want === 'ai') { good = !r.intent; if (!good) wrongFast++; }
    else {
      fastWanted++;
      good = r.intent === want;
      if (good) {
        const a = answer(ctx, q, { activeStudentId: ctx.allowedStudentIds[0], intent: r.intent, routed: r.t });
        ans = (a.text + ' ' + a.cards.map(c => [c.title, c.subject, c.teacherName, c.name].filter(Boolean).join(' ')).join(' ') + ' ' + (a.chips || []).join(' ')).replace(/\s+/g, ' ');
        if (/לא בטוחה שהבנתי|משהו השתבש/.test(ans) || (has && !ans.includes(has))) good = false;
        else fastGot++;
      }
    }
    if (good) ok++; else fails.push(`${uid.padEnd(7)} ${want.padEnd(16)} ${q}  →  ${r.intent || r.why}${ans ? '  | ' + ans.slice(0, 110) : ''}`);
    if (verbose) console.log(good ? 'ok  ' : 'FAIL', ms.toFixed(2) + 'ms', want.padEnd(14), q, '→', r.intent || r.why);
  }
}
console.log(fails.map(f => 'FAIL ' + f).join('\n'));
console.log(`\n${ok}/${n} correct · fast coverage ${fastGot}/${fastWanted} (${Math.round(fastGot / fastWanted * 100)}%) · wrong fast answers on AI questions: ${wrongFast}`);
process.exit(fails.length ? 1 : 0);
