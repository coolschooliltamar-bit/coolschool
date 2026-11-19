// Sync of a real Google account's conversations and memories with Aluma's server (D1).
// Demo accounts never leave the browser. Failures are silent: the browser copy still works.
import { GEMINI_PROXY_URL } from './config.js';
import * as G from './google.js';
import { db, save } from './store.js';

const on = () => !!(GEMINI_PROXY_URL && G.accessToken());
async function req(method, path, body) {
  const r = await fetch(`${GEMINI_PROXY_URL}/db/${path}`, { method, headers: { Authorization: `Bearer ${G.accessToken()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
export const status = { last: null, error: null };

export async function pull(userId) {
  if (!on()) return;
  try {
    const [c, m] = await Promise.all([req('GET', 'convs'), req('GET', 'memories')]);
    const key = `${userId}|${userId}`;
    if (c.data && Array.isArray(c.data)) { (db().convs = db().convs || {})[key] = c.data; }
    if (m.data && Array.isArray(m.data)) db().memories[userId] = m.data;
    save(); status.last = new Date().toISOString(); status.error = null;
  } catch (e) { status.error = e.message; }
}
let timer = null;
export function push(userId) {
  if (!on()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const key = `${userId}|${userId}`;
      const convs = ((db().convs || {})[key] || []).slice(0, 30);
      await Promise.all([req('PUT', 'convs', convs), req('PUT', 'memories', db().memories[userId] || [])]);
      status.last = new Date().toISOString(); status.error = null;
    } catch (e) { status.error = e.message; }
  }, 1500);
}
export async function wipe() { if (on()) { try { await fetch(`${GEMINI_PROXY_URL}/db/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${G.accessToken()}` } }); } catch { /* ignore */ } } }
