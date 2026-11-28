// Browser test of lessons with every kind of question: the explanation screen, then each question answered
// through the screen (word bank, typing, matching, ordering, choice). Start a server first:
//   cd <repo> && python3 -m http.server 8765 ;  node aluma/tests/e2e-lessons.cjs [screenshot-dir]
const { chromium } = require('playwright');
const SHOTS = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } }); await p.addInitScript(() => localStorage.setItem('aluma-tools', 'on'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/aluma/'); await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:8765/aluma/'); await p.click('[data-login="u-noa"]'); await p.waitForSelector('#q');
  const seen = new Set();
  async function answer(right) {
    const q = await p.evaluate(() => { const s = window.__lesson(); return { ...s.qs[s.i], shuf: s.shuf }; });
    if (right) {
      if (q.kind === 'mc' || q.kind === 'tf') await p.click(`[data-opt="${q.answer}"]`);
      if (q.kind === 'write') await p.fill('#wans', q.accept[0]);
      if (q.kind === 'bank') for (const w of q.answers) await p.locator('[data-word]:not([disabled])', { hasText: w }).filter({ hasText: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
      if (q.kind === 'match') for (let i = 0; i < q.pairs.length; i++) { await p.click(`[data-left="${i}"]`); await p.click(`[data-right="${q.shuf.indexOf(q.pairs[i][1])}"]`); }
      if (q.kind === 'order') for (const it of q.items) await p.click(`[data-pick="${q.shuf.indexOf(it)}"]`);
    } else {
      if (q.kind === 'mc' || q.kind === 'tf') await p.click(`[data-opt="${(q.answer + 1) % q.options.length}"]`);
      else if (q.kind === 'write') await p.fill('#wans', 'xyz');
      else if (q.kind === 'bank') { const wrong = q.shuf.map((w, i) => [w, i]).filter(([w]) => !q.answers.includes(w)); for (let k = 0; k < q.answers.length; k++) await p.click(`[data-word="${wrong[k % wrong.length][1]}"]`); }
      else if (q.kind === 'match') { for (let i = 0; i < q.pairs.length; i++) { await p.click(`[data-left="${i}"]`); await p.click(`[data-right="${(q.shuf.indexOf(q.pairs[i][1]) + 1) % q.pairs.length}"]`); } }
      else if (q.kind === 'order') for (const it of q.items.slice().reverse()) await p.click(`[data-pick="${q.shuf.indexOf(it)}"]`);
    }
    if (!seen.has(q.kind)) { seen.add(q.kind); if (SHOTS) await p.screenshot({ path: `${SHOTS}/q-${q.kind}.png` }); }
    await p.click('#check');
    const good = await p.locator('.feedback.good').count() > 0;
    if (SHOTS && !right) await p.screenshot({ path: `${SHOTS}/q-${q.kind}-wrong.png` });
    await p.click('#next');
    return { kind: q.kind, good, review: !!q.review };
  }
  async function lesson(sub, rightAll) {
    await p.evaluate(() => document.querySelector('[data-go="tools"]').click()); await p.click('[data-toolopen="path"]'); await p.waitForTimeout(300);
    await p.click(`[data-sub="${sub}"]`); await p.waitForTimeout(200); await p.click('.node.next');
    await p.waitForSelector('.lintro .intro-text'); const title = await p.locator('.lintro h2').innerText();
    await p.click('#golesson');
    const res = []; for (let i = 0; i < 5; i++) res.push(await answer(rightAll === true ? true : rightAll === false ? false : i % 2 === 0));
    await p.waitForSelector('.lesson-end'); const end = await p.locator('.lesson-end').innerText();
    return { title, res, end };
  }
  for (const sub of ['math', 'english', 'history', 'science']) {
    const a = await lesson(sub, true);
    ok(a.res.every(r => r.good) && a.end.includes('5 מתוך 5'), `${sub} lesson 1 "${a.title}": all answers right → 5/5 (${a.res.map(r => r.kind).join(', ')})`);
    await p.click('#back');
    const c = await lesson(sub, true);
    ok(c.res.some(r => r.review) && c.title !== a.title, `${sub} lesson 2 "${c.title}": its own text, and a review question (${c.res.map(r => r.kind + (r.review ? '*' : '')).join(', ')})`);
    await p.click('#back');
  }
  const w = await lesson('english', false);
  ok(w.res.every(r => !r.good) && w.end.includes('0 מתוך 5'), `wrong answers are marked wrong (${w.res.map(r => r.kind).join(', ')})`);
  ok(seen.size >= 5, `kinds seen on screen: ${[...seen].join(', ')}`);
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
