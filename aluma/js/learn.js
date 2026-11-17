// AI learning tools (Duolingo-style practice path, flashcards, study planner).
// Questions come from a built-in bank in the prototype; with the AI connected they would be generated
// from the class material. Practice only – Aluma still never writes work to hand in (spec 18).
import { db, save, audit } from './store.js';

const mc = (q, options, answer, explain) => ({ kind: 'mc', q, options, answer, explain });
const tf = (q, answer, explain) => ({ kind: 'tf', q, options: ['נכון', 'לא נכון'], answer: answer ? 0 : 1, explain });

// ---------- question banks: subject -> units -> questions ----------
export const BANK = {
  history: { icon: '🏛️', units: [
    { title: 'המהפכה הצרפתית', qs: [
      mc('באיזו שנה פרצה המהפכה הצרפתית?', ['1689', '1789', '1848', '1914'], 1, 'המהפכה פרצה ב-1789, עם כינוס אספת המעמדות וכיבוש הבסטיליה.'),
      mc('מה סימל כיבוש הבסטיליה?', ['ניצחון במלחמה', 'מרד נגד שלטון המלך', 'הכרזת עצמאות', 'חתימת הסכם שלום'], 1, 'הבסטיליה הייתה כלא – סמל לשלטון המלוכה. כיבושה הפך לסמל המהפכה.'),
      tf('"חירות, שוויון, אחווה" הייתה סיסמת המהפכה הצרפתית.', true, 'נכון – זו עדיין הסיסמה הרשמית של צרפת.'),
      mc('מי היה מלך צרפת בזמן המהפכה?', ['לואי ה-14', 'נפוליאון', 'לואי ה-16', 'שארל דה גול'], 2, 'לואי ה-16 הודח ולבסוף הוצא להורג ב-1793.'),
      mc('איזה מסמך נחתם ב-1789 והגדיר זכויות לכל אדם?', ['הצהרת זכויות האדם והאזרח', 'המגנה כרטה', 'החוקה האמריקאית', 'הצהרת בלפור'], 0, 'הצהרת זכויות האדם והאזרח קבעה שבני האדם נולדים חופשיים ושווים בזכויות.'),
      tf('המעמד השלישי כלל את רוב האוכלוסייה בצרפת.', true, 'נכון – איכרים, בורגנים ופועלים, כ-97% מהאוכלוסייה.'),
    ] },
    { title: 'עליית הלאומיות', qs: [
      mc('מהי לאומיות?', ['אמונה שכל עם זכאי למדינה משלו', 'שלטון של מלך יחיד', 'כלכלה ללא מדינה', 'דת מדינה'], 0, 'לאומיות היא תפיסה שלפיה לכל עם יש זכות להגדרה עצמית ולמדינה.'),
      mc('איזו מדינה אוחדה בהנהגת ביסמרק?', ['איטליה', 'גרמניה', 'ספרד', 'פולין'], 1, 'גרמניה אוחדה ב-1871 בהנהגת אוטו פון ביסמרק.'),
      tf('איטליה אוחדה במאה ה-19.', true, 'נכון – תהליך האיחוד (ה"ריסורג׳ימנטו") הושלם ב-1870.'),
      mc('מי נחשב לאבי הציונות המדינית?', ['בן גוריון', 'הרצל', 'ויצמן', 'ז׳בוטינסקי'], 1, 'בנימין זאב הרצל כינס את הקונגרס הציוני הראשון ב-1897.'),
      mc('היכן התכנס הקונגרס הציוני הראשון?', ['וינה', 'ירושלים', 'באזל', 'לונדון'], 2, 'הקונגרס הציוני הראשון התכנס בבאזל שבשווייץ ב-1897.'),
    ] },
    { title: 'המהפכה התעשייתית', qs: [
      mc('באיזו מדינה החלה המהפכה התעשייתית?', ['צרפת', 'בריטניה', 'ארה״ב', 'גרמניה'], 1, 'המהפכה התעשייתית החלה בבריטניה במאה ה-18.'),
      mc('איזו המצאה הניעה מפעלים ורכבות?', ['מנוע הקיטור', 'החשמל', 'הטלפון', 'המטוס'], 0, 'מנוע הקיטור, ששופר בידי ג׳יימס ואט, הניע מכונות ורכבות.'),
      tf('במהפכה התעשייתית אנשים רבים עברו מהכפר לעיר.', true, 'נכון – תהליך העיור: עבודה במפעלים בערים.'),
      mc('מה הייתה אחת הבעיות של פועלי המפעלים?', ['שעות עבודה ארוכות', 'יותר מדי חופשות', 'משכורות גבוהות מדי', 'מחסור במכונות'], 0, 'פועלים, גם ילדים, עבדו 12–16 שעות ביום בתנאים קשים.'),
      mc('מה הוא "ייצור המוני"?', ['ייצור ביד בבית', 'ייצור כמויות גדולות במכונות', 'סחר בין מדינות', 'חקלאות'], 1, 'מכונות במפעלים אפשרו לייצר הרבה מוצרים זהים מהר וזול.'),
    ] },
  ] },
  english: { icon: '🔤', units: [
    { title: 'Vocabulary – School', qs: [
      mc('מה הפירוש של "homework"?', ['שיעורי בית', 'בית ספר', 'עבודה בבית', 'מורה'], 0, 'homework = שיעורי בית.'),
      mc('מה הפירוש של "schedule"?', ['ציון', 'מערכת שעות', 'מבחן', 'כיתה'], 1, 'schedule = לוח זמנים / מערכת שעות.'),
      mc('בחרו את התרגום של "מבחן":', ['test', 'teacher', 'table', 'term'], 0, 'מבחן = test (או exam).'),
      mc('מה הפירוש של "submit"?', ['לשכוח', 'להגיש', 'ללמוד', 'לקרוא'], 1, 'submit = להגיש (עבודה, טופס).'),
      tf('"Classmate" פירושו חבר לכיתה.', true, 'נכון – classmate = חבר/ה לכיתה.'),
    ] },
    { title: 'Grammar – Past Simple', qs: [
      mc('Yesterday I ___ to school.', ['go', 'goes', 'went', 'going'], 2, 'go הוא פועל לא סדיר: go → went.'),
      mc('She ___ her homework last night.', ['did', 'does', 'do', 'doing'], 0, 'do → did בזמן עבר.'),
      mc('We ___ a movie on Sunday.', ['watch', 'watched', 'watches', 'watching'], 1, 'פועל סדיר: מוסיפים ed → watched.'),
      tf('"I eated pizza" is correct.', false, 'לא נכון – eat הוא פועל לא סדיר: ate.'),
      mc('Did you ___ the test?', ['passed', 'pass', 'passing', 'passes'], 1, 'אחרי did באה צורת הבסיס של הפועל: pass.'),
    ] },
    { title: 'Reading – Short texts', qs: [
      mc('"Tom is tired because he slept only 4 hours." Why is Tom tired?', ['He ran a lot', 'He did not sleep enough', 'He is sick', 'He ate too much'], 1, 'because מסביר את הסיבה: he slept only 4 hours.'),
      mc('"The library opens at 8 and closes at 4." When does it close?', ['8', '12', '4', '6'], 2, 'closes at 4.'),
      tf('"Maya loves math but hates history." Maya likes history.', false, 'hates = שונאת, אז מאיה לא אוהבת היסטוריה.'),
      mc('"It was raining, so we stayed home." What did they do?', ['Went to the beach', 'Stayed home', 'Played outside', 'Went to school'], 1, 'so = לכן: they stayed home.'),
    ] },
  ] },
  science: { icon: '🔬', units: [
    { title: 'התא החי', qs: [
      mc('מהי היחידה הבסיסית של כל יצור חי?', ['האטום', 'התא', 'האיבר', 'הרקמה'], 1, 'התא הוא יחידת המבנה והתפקוד הבסיסית של כל יצור חי.'),
      mc('איזה איברון נמצא בתא צמחי אך לא בתא בעלי חיים?', ['גרעין', 'קרום תא', 'כלורופלסט', 'מיטוכונדריה'], 2, 'בכלורופלסטים מתרחשת הפוטוסינתזה – רק בתאי צמחים.'),
      tf('בגרעין התא נמצא החומר התורשתי (DNA).', true, 'נכון – הגרעין מכיל את ה-DNA.'),
      mc('מה תפקיד המיטוכונדריה?', ['ייצור אנרגיה', 'פוטוסינתזה', 'הגנה על התא', 'אחסון מים'], 0, 'המיטוכונדריה היא "תחנת הכוח" של התא – בה מתרחשת הנשימה התאית.'),
      mc('מה מקיף את התא הצמחי מחוץ לקרום?', ['דופן תא', 'שלד', 'עור', 'ציטופלסמה'], 0, 'דופן התא נותנת לתא הצמחי צורה וחוזק.'),
    ] },
    { title: 'כוחות ותנועה', qs: [
      mc('מה מושך גופים לכיוון כדור הארץ?', ['חיכוך', 'כוח הכבידה', 'מגנטיות', 'חשמל'], 1, 'כוח הכבידה (גרביטציה) מושך כל גוף לעבר מרכז כדור הארץ.'),
      mc('באיזו יחידה מודדים כוח?', ['קילוגרם', 'ניוטון', 'מטר', 'ג׳אול'], 1, 'כוח נמדד בניוטון (N).'),
      tf('חיכוך תמיד פועל נגד כיוון התנועה.', true, 'נכון – חיכוך מתנגד לתנועה.'),
      mc('מכונית נוסעת 100 ק״מ בשעתיים. מה מהירותה הממוצעת?', ['50 קמ״ש', '100 קמ״ש', '200 קמ״ש', '25 קמ״ש'], 0, 'מהירות = דרך ÷ זמן = 100 ÷ 2 = 50 קמ״ש.'),
    ] },
    { title: 'מערכת העיכול', qs: [
      mc('היכן מתחיל העיכול?', ['בקיבה', 'בפה', 'במעי הדק', 'בכבד'], 1, 'העיכול מתחיל בפה – לעיסה ורוק.'),
      mc('באיזה איבר נספגים רוב חומרי המזון לדם?', ['קיבה', 'מעי גס', 'מעי דק', 'ושט'], 2, 'במעי הדק יש סיסים שמגדילים את שטח הספיגה.'),
      tf('הקיבה מפרישה חומצה.', true, 'נכון – חומצת הקיבה עוזרת לפרק מזון ולהרוג חיידקים.'),
      mc('מה תפקיד המעי הגס?', ['ספיגת מים', 'פירוק חלבונים', 'ייצור רוק', 'ספיגת סוכר'], 0, 'במעי הגס נספגים בעיקר מים.'),
    ] },
  ] },
  math: { icon: '➗', units: [{ title: 'משוואות ממעלה ראשונה', gen: 'eq' }, { title: 'אחוזים', gen: 'pct' }, { title: 'פונקציה קווית', gen: 'lin' }] },
};
export const LEARN_SUBJECTS = Object.keys(BANK);
const LESSONS_PER_UNIT = 3, Q_PER_LESSON = 5;

// math questions are generated so they never run out
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function shuffleOpts(correct, wrongs) {
  const opts = [...new Set([correct, ...wrongs])].slice(0, 4);
  while (opts.length < 4) opts.push(correct + opts.length * 3);
  opts.sort(() => Math.random() - 0.5);
  return { options: opts.map(String), answer: opts.indexOf(correct) };
}
function genMath(kind) {
  if (kind === 'eq') { const x = ri(-6, 9), a = ri(2, 7), b = ri(-10, 12), c = a * x + b; const o = shuffleOpts(x, [x + 1, x - 2, -x || 3]);
    return { kind: 'mc', q: `פתרו: ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`, ...o, explain: `מעבירים: ${a}x = ${c} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${c - b}, ולכן x = ${c - b} ÷ ${a} = ${x}.` }; }
  if (kind === 'pct') { const p = [10, 20, 25, 50, 75][ri(0, 4)], n = ri(2, 12) * 20, r = n * p / 100; const o = shuffleOpts(r, [r + 10, r / 2, n - r]);
    return { kind: 'mc', q: `כמה הם ${p}% מתוך ${n}?`, ...o, explain: `${p}% = ${p}/100, ולכן ${n} × ${p} ÷ 100 = ${r}.` }; }
  const m = ri(-4, 5) || 2, b = ri(-6, 6), x = ri(-3, 4), y = m * x + b; const o = shuffleOpts(y, [y + m, y - 1, m * x]);
  return { kind: 'mc', q: `בפונקציה y = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}, מה הערך של y כש-x = ${x}?`, ...o, explain: `מציבים: y = ${m}·(${x}) ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${y}.` };
}

export function lessonQuestions(subject, unitIdx) {
  const unit = BANK[subject].units[unitIdx];
  if (unit.gen) return Array.from({ length: Q_PER_LESSON }, () => genMath(unit.gen));
  return [...unit.qs].sort(() => Math.random() - 0.5).slice(0, Q_PER_LESSON);
}

// ---------- progress (per user) ----------
export function progress(userId) {
  const L = db().learn = db().learn || {};
  return (L[userId] = L[userId] || { xp: 0, streak: 0, lastDay: null, done: {}, cards: {}, plans: [] });
}
export const lessonKey = (s, u, l) => `${s}:${u}:${l}`;
export function unitState(userId, subject, u) {
  const p = progress(userId);
  return Array.from({ length: LESSONS_PER_UNIT }, (_, l) => !!p.done[lessonKey(subject, u, l)]);
}
// the next lesson to do in a subject: [unit, lesson] or null if all done
export function nextLesson(userId, subject) {
  for (let u = 0; u < BANK[subject].units.length; u++) {
    const st = unitState(userId, subject, u);
    const l = st.indexOf(false);
    if (l !== -1) return [u, l];
  }
  return null;
}
export function finishLesson(userId, subject, u, l, correct, total) {
  const p = progress(userId);
  const xp = correct * 10 + (correct === total ? 10 : 0);
  p.xp += xp;
  if (correct >= Math.ceil(total * 0.6)) p.done[lessonKey(subject, u, l)] = true;
  const today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
  if (p.lastDay !== today) { p.streak = p.lastDay === yest ? p.streak + 1 : 1; p.lastDay = today; }
  save(); audit(userId, 'practice_done', { kind: subject });
  return { xp, passed: !!p.done[lessonKey(subject, u, l)] };
}

// ---------- flashcards (simple spaced repetition: boxes 1..4) ----------
export function flashDeck(subject) {
  if (subject === 'math') return [
    ['מה זה משוואה ממעלה ראשונה?', 'משוואה שבה הנעלם מופיע בחזקה 1, למשל 2x + 3 = 11'],
    ['איך מחשבים 25% ממספר?', 'מחלקים ב-4 (או כופלים ב-0.25)'],
    ['מה השיפוע בפונקציה y = 3x + 2?', '3 – המספר שליד x'],
    ['מה נקודת החיתוך עם ציר y ב-y = 3x + 2?', '(0, 2) – המספר החופשי'],
    ['מה זה אחוז?', 'חלק מתוך 100'],
  ];
  return BANK[subject].units.flatMap(u => u.qs.filter(q => q.kind === 'mc').map(q => [q.q, q.options[q.answer]]));
}
export function cardBox(userId, subject, i) { return (progress(userId).cards[`${subject}:${i}`] || 1); }
export function rateCard(userId, subject, i, knew) {
  const p = progress(userId), k = `${subject}:${i}`;
  p.cards[k] = knew ? Math.min(4, (p.cards[k] || 1) + 1) : 1;
  save();
}
