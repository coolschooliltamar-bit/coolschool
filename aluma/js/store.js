// Browser storage for the prototype. In the real product this is the server + PostgreSQL (spec 03).
// Everything the users create (messages, links, memories, audit) lives here, per browser.
import { INITIAL_LINKS } from './data.js';

const KEY = 'aluma-proto-v1';
const defaults = () => ({
  links: INITIAL_LINKS.map(l => ({ ...l, createdAt: new Date().toISOString() })),
  parentCodes: [],            // {code, studentId, createdAt, expiresAt, usedBy}
  inbox: [],                  // messages delivered to teachers (spec 08)
  actions: {},                // pending actions (spec 03 pending_actions)
  audit: [],                  // append-only audit log (spec 02)
  memories: {},               // userId -> [{id, text, at}]
  conversations: {},          // userId|role -> [{who, html...}] (rendered transcript)
  rate: {},                   // userId -> {date, sent}
  feedback: [],
  settings: {},               // userId -> {theme, quietFrom, quietTo, shortAnswers}
  policies: { parentGrades: true, parentAttendance: true, parentAssignments: true, dailyMessageLimit: 10, quietFrom: '20:00', quietTo: '07:30', historyDays: 90 },
  emergencyStop: false,
  stats: { questions: 0 },
});

let state;
try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
catch { state = defaults(); }

export const db = () => state;
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: demo keeps working in memory */ } }
export function resetAll() { state = defaults(); save(); }

export function audit(actor, action, details = {}) {
  state.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, ...details });
  if (state.audit.length > 500) state.audit.splice(0, state.audit.length - 500);
  save();
}

// session lives in sessionStorage (closes with the tab), like a short session cookie
const SKEY = 'aluma-proto-session';
export const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch { return null; } };
export const setSession = s => { try { s ? sessionStorage.setItem(SKEY, JSON.stringify(s)) : sessionStorage.removeItem(SKEY); } catch { /* ignore */ } };

export const userSettings = id => (state.settings[id] = state.settings[id] || { theme: 'light', quietFrom: '20:00', quietTo: '07:30' });
