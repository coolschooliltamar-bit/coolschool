// Browser test: staying signed in. Google and Aluma's server are faked: signing in once with Google keeps you
// signed in after a reload / a new tab (only a session id is stored – never a Google token), "התנתקות" ends it,
// and a demo account also stays signed in. Start a server first: cd <repo> && python3 -m http.server 8765
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const BASE = 'http://localhost:8765/aluma/';
const GIS = `window.google = { accounts: { oauth2: {
  initCodeClient: c => ({ requestCode: () => setTimeout(() => c.callback({ code: 'code-1' }), 10) }),
  initTokenClient: c => ({ requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'tab-only', scope: c.scope }), 10) }),
  revoke: (t, cb) => cb && cb() } } };`;
(async () => {
  const b = await chromium.launch(); const ctxB = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const calls = [];
  const jsonR = (r, o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
  let refreshOk = true;
  await ctxB.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: GIS }));
  await ctxB.route('https://aluma.aluma-school.workers.dev/**', async r => {
    const u = new URL(r.request().url()); const body = r.request().postData();
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    calls.push(u.pathname + (body ? ' ' + body : ''));
    if (u.pathname === '/health') return jsonR(r, { ok: true, stay: true });
    if (u.pathname === '/auth/exchange') return jsonR(r, { session: 'S'.repeat(64), access_token: 'AT-1', expires_in: 3599, scope: 'openid email profile https://www.googleapis.com/auth/classroom.courses.readonly' });
    if (u.pathname === '/auth/refresh') return refreshOk ? jsonR(r, { access_token: 'AT-2', expires_in: 3599, scope: 'openid email' }) : jsonR(r, { error: { message: 'session_ended' } }, 401);
    if (u.pathname === '/auth/logout') return jsonR(r, { ok: true });
    return jsonR(r, {});
  });
  await ctxB.route('https://*.googleapis.com/**', r => jsonR(r, {}));   // registered first: later routes win
  await ctxB.route('https://www.googleapis.com/oauth2/v3/userinfo', r => jsonR(r, { sub: 'g1', name: 'דנה בדיקה', email: 'dana@example.com' }));
  await ctxB.route('https://classroom.googleapis.com/**', r => jsonR(r, { courses: [] }));

  const p = await ctxB.newPage();
  await p.goto(BASE); await p.waitForSelector('#gsignin'); await p.waitForTimeout(400);
  await p.click('#gsignin'); await p.waitForSelector('#mebtn', { timeout: 10000 });
  const store = await p.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  ok(calls.some(c => c.startsWith('/auth/exchange') && c.includes('code-1')), 'Google sign-in sends the one-time code to Aluma\'s server');
  ok(store.includes('S'.repeat(64)) && !store.includes('AT-1') && !store.includes('AT-2'), 'the browser keeps only the session id – no Google token');

  await p.reload(); await p.waitForSelector('#mebtn', { timeout: 10000 });
  ok(calls.some(c => c.startsWith('/auth/refresh')) && await p.locator('.me-row b').innerText() === 'דנה בדיקה', 'after a reload the user is still signed in, with no Google window');
  const p2 = await ctxB.newPage(); await p.close();
  await p2.goto(BASE); await p2.waitForSelector('#mebtn', { timeout: 10000 });
  ok(true, 'closing the tab and opening the site again – still signed in');

  await p2.click('#mebtn'); await p2.click('#acctout'); await p2.waitForSelector('#gsignin');
  ok(calls.some(c => c.startsWith('/auth/logout') && c.includes('S'.repeat(64)) && c.includes('"revoke":false')) && !(await p2.evaluate(() => localStorage.getItem('aluma-stay'))), '"התנתקות" ends the session on the server and in the browser');
  await p2.reload(); await p2.waitForSelector('#gsignin'); ok(true, 'after logging out, a reload shows the login screen');

  // the server ended the session (30 days unused, or access removed at Google) → back to the login screen
  await p2.click('#gsignin'); await p2.waitForSelector('#mebtn', { timeout: 10000 }); refreshOk = false;
  await p2.reload(); await p2.waitForSelector('#gsignin', { timeout: 10000 });
  ok(!(await p2.evaluate(() => localStorage.getItem('aluma-stay'))), 'an ended session goes back to the login screen and is forgotten');

  // a demo account also stays signed in in a new tab
  await p2.click('[data-login="u-noa"]'); await p2.waitForSelector('#mebtn');
  const p3 = await ctxB.newPage(); await p3.goto(BASE); await p3.waitForSelector('#mebtn');
  ok(await p3.locator('.me-row b').innerText() === 'נועה לוי', 'a demo account stays signed in in a new tab');
  // the server is not set up for it yet (no "stay" in /health): sign-in works as before, for this tab only
  const c2 = await b.newContext(); const seen = [];
  await c2.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: GIS }));
  await c2.route('https://aluma.aluma-school.workers.dev/**', r => { seen.push(new URL(r.request().url()).pathname); return jsonR(r, new URL(r.request().url()).pathname === '/health' ? { ok: true } : {}); });
  await c2.route('https://*.googleapis.com/**', r => jsonR(r, {}));
  await c2.route('https://www.googleapis.com/oauth2/v3/userinfo', r => jsonR(r, { sub: 'g1', name: 'דנה בדיקה', email: 'dana@example.com' }));
  await c2.route('https://classroom.googleapis.com/**', r => jsonR(r, { courses: [] }));
  const q = await c2.newPage(); await q.goto(BASE); await q.waitForSelector('#gsignin'); await q.waitForTimeout(400);
  await q.click('#gsignin'); await q.waitForSelector('#mebtn', { timeout: 10000 });
  ok(!seen.some(x => x.startsWith('/auth/')) && !(await q.evaluate(() => localStorage.getItem('aluma-stay'))), 'without the server part, Google sign-in still works (this tab only)');
  await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
