// Browser test: the one-click demo link (?demo=), reminders under the bell, and the Tools page – choosing a tool
// makes the next message build that thing. Start a server first: cd <repo> && python3 -m http.server 8765
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const BASE = 'http://localhost:8765/aluma/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); await p.addInitScript(() => localStorage.setItem('aluma-tools', 'on'));
  await p.route('https://aluma.aluma-school.workers.dev/**', r => r.abort());   // no network: the local engine answers
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear());

  // 15: one click into a demo account
  await p.goto(BASE + '?demo=student'); await p.waitForSelector('#q');
  ok((await p.locator('.me-row b').innerText()).includes('נועה') && !p.url().includes('demo='), '?demo=student opens Noa at once, and the link is cleaned');

  // 12: reminders
  const n = +(await p.locator('.bell-n').innerText());
  ok(n >= 2, `the bell shows ${n} reminders`);
  ok(await p.locator('.rem-strip .rem').count() >= 1, 'a new chat starts with "לפני שתשאלו" reminders');
  await p.click('#bell'); await p.waitForSelector('.remind:not([hidden]) .rem');
  const first = await p.locator('.remind .rem').first().innerText();
  await p.locator('[data-dismiss]').first().click();
  ok(+(await p.locator('.bell-n').innerText()) === n - 1 && !(await p.locator('.remind').innerText()).includes(first), 'a dismissed reminder disappears and the count drops');

  // 13: one Tools button; a tool tells the AI what to build
  ok(await p.locator('.side [data-go]').evaluateAll(xs => xs.map(x => x.dataset.go)).then(g => g.includes('tools') && !g.includes('path') && !g.includes('cards')), 'the sidebar has one "כלים" button instead of five');
  await p.click('[data-go="tools"]'); await p.waitForSelector('.tool-card');
  ok(await p.locator('.tool-card').count() === 5, 'the student sees 5 tools');
  await p.click('[data-toolai="path"]'); await p.waitForSelector('.toolchip');
  ok((await p.getAttribute('#q', 'placeholder')).includes('על מה המסלול'), 'choosing "מסלול תרגול" puts a tool chip in the chat');
  await p.fill('#q', 'משוואות לקראת המבחן'); await p.press('#q', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.msg.ai:not(.thinking)').length && !document.querySelector('.ai-text.typing'), null, { timeout: 30000 });
  const built = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('aluma-proto-v1')).paths || {}).map(x => ({ kind: x.kind, subject: x.subject })));
  ok(built.length === 1 && built[0].kind === 'path' && built[0].subject === 'math', `"משוואות לקראת המבחן" (no word "מסלול") built a math path: ${JSON.stringify(built)}`);
  ok(!(await p.locator('.toolchip').count()), 'the tool is used once, then the chat is normal again');
  await p.click('[data-go="tools"]'); await p.click('[data-toolai="planner"]'); await p.fill('#q', 'המבחן במתמטיקה'); await p.press('#q', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.msg.ai:not(.thinking)').length && !document.querySelector('.ai-text.typing'), null, { timeout: 30000 });
  const plans = await p.evaluate(() => (JSON.parse(localStorage.getItem('aluma-proto-v1')).learn['u-noa'].plans || []).map(x => x.sub));
  ok(plans[0] === 'math', `the planner tool built a plan for the math test: ${plans}`);

  // parents: reminders about their children only
  await p.goto(BASE + '?demo=parent'); await p.waitForSelector('#bell');
  await p.click('#bell'); await p.waitForSelector('.remind .rem');
  const txt = await p.locator('.remind').innerText();
  ok(txt.includes('דנה') && !txt.includes('נועה'), 'a parent sees reminders about their own children');
  await p.click('[data-go="tools"]'); ok(await p.locator('.tool-card').count() >= 4, 'the parent\'s tools include the ready questions');

  // teachers: a class path from the tool
  await p.goto(BASE + '?demo=teacher'); await p.waitForSelector('#q');
  ok(!(await p.locator('#bell').count()), 'teachers have no student reminders');
  await p.click('[data-go="tools"]'); await p.click('[data-toolai="tpaths"]'); await p.fill('#q', 'חזרה על המהפכה הצרפתית לט׳2'); await p.press('#q', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.msg.ai:not(.thinking)').length && !document.querySelector('.ai-text.typing'), null, { timeout: 30000 });
  const tp = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('aluma-proto-v1')).paths || {}).filter(x => x.ownerId === 'u-rina').map(x => ({ cls: x.classId, draft: x.draft, subject: x.subject })));
  ok(tp.length === 1 && tp[0].cls === 'c-9-2' && tp[0].draft && tp[0].subject === 'history', `the teacher's tool made a history draft for ט׳2: ${JSON.stringify(tp)}`);

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  // by default the Tools button is "coming soon": disabled, and the tools page cannot be opened
  const q = await b.newPage({ viewport: { width: 1200, height: 900 } }); await q.route('https://aluma.aluma-school.workers.dev/**', r => r.abort());
  await q.goto(BASE + '?demo=student'); await q.waitForSelector('.nav.soon');
  ok(await q.locator('.nav.soon').isDisabled() && /Coming soon/.test(await q.locator('.nav.soon').innerText()) && await q.locator('[data-go="tools"]').count() === 0, 'the Tools button says Coming soon and is disabled');
  await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
