// Browser test of demo card trading. Start a server first: cd <repo> && python3 -m http.server 8765
// Run: NODE_PATH=$(npm root -g) node aluma/tests/e2e-trade.cjs
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('aluma-proto-v1')));
  await p.goto('http://localhost:8765/aluma/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto('http://localhost:8765/aluma/'); await p.click('[data-login="u-noa"]'); await p.waitForSelector('#view');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('aluma-proto-v1')); s.game = s.game || {}; s.game['u-noa'] = Object.assign(s.game['u-noa'] || {}, { owned: [41, 42, 45, 45, 46, 81, 300, 77] }); localStorage.setItem('aluma-proto-v1', JSON.stringify(s)); });
  await p.goto('http://localhost:8765/aluma/'); await p.waitForSelector('#view');
  await p.click('[data-go=game]'); await p.click('[data-gtab=trade]');
  ok((await p.locator('#gbody').innerText()).includes('לשתף את האוסף'), 'must share before trading');
  await p.click('#gbody [data-goto=class]'); await p.check('#gshare'); await p.click('[data-gtab=trade]'); await p.waitForTimeout(300);
  ok(await p.locator('.toffer').count() >= 1 && (await p.locator('.trade').innerText()).includes('מציע/ה לך'), 'a demo classmate sent an offer');
  await p.screenshot({ path: require('os').tmpdir() + '/trade1.png', fullPage: true });
  // new offer: pick first mate
  const opts = await p.locator('#tto option').evaluateAll(o => o.map(x => x.value).filter(Boolean));
  ok(opts.length > 0, `${opts.length} classmates to trade with`);
  await p.selectOption('#tto', opts[0]); await p.waitForTimeout(200);
  const before = (await S()).game['u-noa'].owned.length;
  await p.locator('[data-tpick=want]').first().click(); await p.locator('[data-tpick=give]').first().click(); 
  ok(await p.locator('.tsend .tfair').count() === 1, 'fairness shown: ' + await p.locator('.tsend .tfair').innerText());
  await p.click('#tsend'); await p.waitForTimeout(300);
  ok((await S()).game['u-noa'].owned.length === before - 1, 'offered card put aside (escrow)');
  ok(await p.locator('[data-tact=cancel]').count() === 1, 'pending offer shown with cancel');
  await p.waitForTimeout(4200);
  const t = (await S()).trades.find(x => x.from === 'u-noa');
  ok(['accepted', 'declined'].includes(t.status), 'classmate answered: ' + t.status);
  const after = (await S()).game['u-noa'].owned.length;
  ok(after === before, `collection size back to ${before} after the answer (${after})`);
  // accept the incoming offer
  const inc = (await S()).trades.find(x => x.to === 'u-noa' && x.status === 'pending');
  if (inc) { await p.click(`[data-tact=accept][data-tid="${inc.id}"]`); await p.waitForTimeout(300);
    const s2 = await S(); ok(s2.trades.find(x => x.id === inc.id).status === 'accepted' && s2.game['u-noa'].owned.includes(inc.give[0]), 'accepting an offer swaps the cards'); }
  await p.screenshot({ path: require('os').tmpdir() + '/trade2.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'no horizontal scroll on phone');
  console.log('errors', errs); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await b.close();
})();
