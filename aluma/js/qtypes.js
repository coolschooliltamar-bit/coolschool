// Question types for practice lessons. Every question has { kind, q, explain } and the fields of its kind:
//   mc     – multiple choice:   options[], answer (index)
//   tf     – true / false:      options ['נכון','לא נכון'], answer (0 | 1)
//   bank   – word bank:         q has one "___" per blank, bank[] (the words, with a few extra), answers[] (per blank)
//   write  – typed answer:      accept[] (accepted answers; numbers compare as numbers)
//   match  – matching pairs:    pairs[[left, right], …]
//   order  – put in order:      items[] in the right order
// The same shapes come from the question bank, from Gemini (validated by normalize) and from uploaded files.
export const KINDS = ['mc', 'tf', 'bank', 'write', 'match', 'order'];
export const KIND_NAMES = { mc: 'בחירה', tf: 'נכון/לא נכון', bank: 'מחסן מילים', write: 'כתיבה', match: 'התאמה', order: 'סידור' };

// ---------- builders (used by the question bank) ----------
export const mc = (q, options, answer, explain) => ({ kind: 'mc', q, options, answer, explain });
export const tf = (q, answer, explain) => ({ kind: 'tf', q, options: ['נכון', 'לא נכון'], answer: answer ? 0 : 1, explain });
export const bank = (q, words, answers, explain) => ({ kind: 'bank', q, bank: words, answers, explain });
export const write = (q, accept, explain) => ({ kind: 'write', q, accept, explain });
export const match = (q, pairs, explain) => ({ kind: 'match', q, pairs, explain });
export const order = (q, items, explain) => ({ kind: 'order', q, items, explain });

// ---------- answers ----------
// compare loosely: no niqqud, no punctuation, quotes, dashes or spaces; "−" counts as "-"
export const norm = s => String(s ?? '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[−–]/g, '-')
  .replace(/[\s'"`׳״.,:;!?()\-־_]/g, '');
const num = s => { const t = String(s ?? '').replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
export function sameText(a, b) {
  const x = num(a), y = num(b);
  if (x != null && y != null) return Math.abs(x - y) < 1e-9;
  return !!norm(a) && norm(a) === norm(b);
}
// resp: mc/tf → index; bank → [word per blank]; write → string; match → [right shown for each left]; order → [items]
export function check(q, resp) {
  if (resp == null) return false;
  switch (q.kind) {
    case 'mc': case 'tf': return resp === q.answer;
    case 'bank': return Array.isArray(resp) && resp.length === q.answers.length && q.answers.every((a, i) => sameText(a, resp[i]));
    case 'write': return q.accept.some(a => sameText(a, resp));
    case 'match': return Array.isArray(resp) && q.pairs.every((p, i) => resp[i] === p[1]);
    case 'order': return Array.isArray(resp) && resp.length === q.items.length && q.items.every((it, i) => resp[i] === it);
    default: return false;
  }
}
// is the response complete enough to check?
export function ready(q, resp) {
  if (resp == null) return false;
  if (q.kind === 'bank') return Array.isArray(resp) && resp.length === q.answers.length && resp.every(Boolean);
  if (q.kind === 'write') return String(resp).trim().length > 0;
  if (q.kind === 'match') return Array.isArray(resp) && q.pairs.every((_, i) => resp[i] != null);
  if (q.kind === 'order') return Array.isArray(resp) && resp.length === q.items.length;
  return Number.isInteger(resp);
}
// the right answer in words (feedback, teacher preview)
export function answerText(q) {
  switch (q.kind) {
    case 'mc': case 'tf': return q.options[q.answer];
    case 'bank': return q.answers.join(' · ');
    case 'write': return q.accept[0];
    case 'match': return q.pairs.map(p => `${p[0]} ← ${p[1]}`).join(' · ');
    case 'order': return q.items.join(' ← ');
    default: return '';
  }
}

// ---------- validation (Gemini / files) ----------
const clean = (s, n = 300) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = a => [...new Set(a)];
// raw: { type|kind, q, options, answer, answers, pairs:[{a,b}|[a,b]], items, explain } → a question, or null
export function normalize(raw) {
  if (!raw) return null;
  const kind = raw.kind || raw.type, q = clean(raw.q, 400), explain = clean(raw.explain, 400);
  if (!q || !KINDS.includes(kind)) return null;
  if (kind === 'mc') {
    const options = (raw.options || []).map(o => clean(o, 120)).filter(Boolean).slice(0, 4);
    const answer = Number.isInteger(raw.answer) ? raw.answer : -1;
    return options.length >= 2 && uniq(options).length === options.length && answer >= 0 && answer < options.length ? { kind, q, options, answer, explain } : null;
  }
  if (kind === 'tf') {
    const answer = raw.answer === 0 || raw.answer === true || raw.answer === 'נכון' ? 0 : raw.answer === 1 || raw.answer === false || raw.answer === 'לא נכון' ? 1 : -1;
    return answer < 0 ? null : { kind, q, options: ['נכון', 'לא נכון'], answer, explain };
  }
  if (kind === 'bank') {
    const answers = (raw.answers || []).map(a => clean(a, 60)).filter(Boolean).slice(0, 3);
    const blanks = (q.match(/_{2,}/g) || []).length;
    const words = uniq([...answers, ...(raw.options || raw.bank || []).map(w => clean(w, 60)).filter(Boolean)]).slice(0, 8);
    if (!answers.length || blanks !== answers.length || words.length < answers.length + 1) return null;
    return { kind, q: q.replace(/_{2,}/g, '___'), bank: words, answers, explain };
  }
  if (kind === 'write') {
    const accept = uniq((raw.answers || raw.accept || []).map(a => clean(a, 80)).filter(Boolean)).slice(0, 6);
    return accept.length ? { kind, q, accept, explain } : null;
  }
  if (kind === 'match') {
    const pairs = (raw.pairs || []).map(p => Array.isArray(p) ? [clean(p[0], 80), clean(p[1], 120)] : [clean(p && p.a, 80), clean(p && p.b, 120)]).filter(p => p[0] && p[1]).slice(0, 5);
    if (pairs.length < 3 || uniq(pairs.map(p => p[0])).length !== pairs.length || uniq(pairs.map(p => p[1])).length !== pairs.length) return null;
    return { kind, q, pairs, explain };
  }
  if (kind === 'order') {
    const items = (raw.items || raw.options || []).map(i => clean(i, 120)).filter(Boolean).slice(0, 6);
    return items.length >= 3 && uniq(items).length === items.length ? { kind, q, items, explain } : null;
  }
  return null;
}

// a Gemini schema that can hold every kind (fields a kind does not use are left out)
export const SCHEMA = { type: 'OBJECT', properties: {
  type: { type: 'STRING', enum: KINDS }, q: { type: 'STRING' }, options: { type: 'ARRAY', items: { type: 'STRING' } }, answer: { type: 'INTEGER' },
  answers: { type: 'ARRAY', items: { type: 'STRING' } }, pairs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { a: { type: 'STRING' }, b: { type: 'STRING' } }, required: ['a', 'b'] } },
  items: { type: 'ARRAY', items: { type: 'STRING' } }, explain: { type: 'STRING' } }, required: ['type', 'q', 'explain'] };
export const HOW_TO = `סוגי שאלות (type):
mc – בחירה: options (4), answer = אינדקס התשובה הנכונה מ-0.
tf – נכון/לא נכון: answer = 0 אם הטענה נכונה, 1 אם לא.
bank – השלמה ממחסן מילים: ב-q משפט עם ___ לכל חסר (1–2), answers = המילים הנכונות לפי הסדר, options = 2–3 מילים מסיחות נוספות.
write – כתיבה: התלמיד מקליד מילה, מושג או מספר קצר. answers = כל הכתיבים הנכונים המקובלים.
match – התאמה: pairs = 3–5 זוגות {a, b} (מושג והסבר, מילה ותרגום, אדם ואירוע, תרגיל ותוצאה).
order – סידור: items = 3–5 פריטים בסדר הנכון (אירועים לפי הזמן, שלבים בתהליך, צעדי פתרון, מילים במשפט).`;
