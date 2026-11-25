// Question types (js/qtypes.js), the basic path's lessons (js/bank-lessons.js) and how a lesson is put together
// (learn.js): every question in the bank is valid, every lesson has its own questions of several kinds, and a
// lesson asks mostly its own questions plus a review question. Usage: node aluma/tests/qtypes-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const QT = await import('../js/qtypes.js');
const L = await import('../js/learn.js');
const { LESSONS, genQuestion } = await import('../js/bank-lessons.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// checking answers
ok(QT.check(QT.write('?', ['לואי ה-16']), 'לואי ה16') && QT.check(QT.write('?', ['לואי ה-16']), ' לוּאִי  ה-16 '), 'typed answers: dashes, spaces and niqqud do not matter');
ok(QT.check(QT.write('?', ['−2']), '-2') && QT.check(QT.write('?', ['10']), '10.0') && !QT.check(QT.write('?', ['10']), '100'), 'numbers compare as numbers');
ok(QT.check(QT.write('?', ['Teacher']), 'teacher') && !QT.check(QT.write('?', ['teacher']), 'teach'), 'English is not case sensitive, but must be the word');
const b = QT.bank('a ___ b ___', ['x', 'y', 'z'], ['x', 'y']);
ok(QT.check(b, ['x', 'y']) && !QT.check(b, ['y', 'x']) && !QT.ready(b, ['x', null]), 'word bank: every blank, in order');
const m = QT.match('?', [['a', '1'], ['b', '2'], ['c', '3']]);
ok(QT.check(m, ['1', '2', '3']) && !QT.check(m, ['2', '1', '3']) && !QT.ready(m, ['1', null, '3']), 'matching: every pair must be right');
const o = QT.order('?', ['1', '2', '3']);
ok(QT.check(o, ['1', '2', '3']) && !QT.check(o, ['2', '1', '3']), 'ordering: the exact order');

// validation of model output
ok(QT.normalize({ type: 'bank', q: 'התא הוא ___ של החיים', answers: ['היחידה'], options: ['האיבר', 'הכוכב'], explain: '' }).bank.length === 3, 'bank from the model: the answer joins the word bank');
ok(QT.normalize({ type: 'bank', q: 'בלי מקום ריק', answers: ['x'], options: ['y'] }) === null, 'bank without a blank is refused');
ok(QT.normalize({ type: 'match', q: '?', pairs: [{ a: 'a', b: '1' }, { a: 'b', b: '1' }, { a: 'c', b: '3' }] }) === null, 'match with a repeated answer is refused');
ok(QT.normalize({ type: 'mc', q: '?', options: ['a', 'b'], answer: 5 }) === null, 'mc with a wrong answer index is refused');
ok(QT.normalize({ type: 'order', q: '?', items: ['a', 'b', 'c'], explain: '<b>x</b>' }).explain === 'bx/b', 'html is stripped');

// the bank content
const valid = q => !!QT.normalize(q) && (q.kind !== 'bank' || q.answers.every(a => q.bank.includes(a)));
let all = 0, bad = [];
for (const [s, units] of Object.entries(LESSONS)) units.forEach((ls, u) => ls.forEach((les, l) => {
  const qs = les.gen ? Array.from({ length: 60 }, () => genQuestion(les.gen)) : les.qs;
  qs.forEach(q => { all++; if (!valid(q)) bad.push(`${s}:${u}:${l} ${q.kind} ${q.q}`); });
}));
ok(!bad.length, `every bank question is valid (${all} checked)${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
ok(Object.values(LESSONS).every(units => units.length === 3 && units.every(ls => ls.length === 3 && ls.every(x => x.title && x.text.length > 200))), 'every unit has 3 lessons, each with a title and a text');
ok(Object.values(LESSONS).flat(2).filter(x => x.qs).every(x => x.qs.length >= 5 && new Set(x.qs.map(q => q.kind)).size >= 3), 'every lesson has at least 5 questions of at least 3 kinds');
ok(new Set(Object.values(LESSONS).flat(2).flatMap(x => x.qs || Array.from({ length: 30 }, () => genQuestion(x.gen))).map(q => q.kind)).size === 6, 'all 6 kinds are used');
// math: a generated "write" answer is the real answer
const mathOk = Array.from({ length: 300 }, () => genQuestion('eq2')).filter(q => q.kind === 'write').every(q => { const [, a, sign, b, c] = q.q.match(/(\d+)x ([+−]) (\d+) = (-?\d+)/); return +q.accept[0] * +a + (sign === '+' ? +b : -b) === +c; });
ok(mathOk, 'generated equations: the accepted answer solves the equation');

// a lesson: its own questions + one review question from an earlier lesson
const hist = L.BANK.history.units[0];
const l2 = L.lessonQuestions('history', 0, 1);
const own = new Set(hist.lessons[1].qs.map(q => q.q)), earlier = new Set(hist.lessons[0].qs.map(q => q.q));
ok(l2.length === 5 && l2.filter(q => q.review).length === 1 && l2.filter(q => !q.review).every(q => own.has(q.q)) && l2.filter(q => q.review).every(q => earlier.has(q.q)), 'lesson 2: four of its own questions and one review from lesson 1');
ok(L.lessonQuestions('history', 0, 0).every(q => !q.review), 'the very first lesson has no review');
ok(L.lessonQuestions('history', 1, 0).some(q => q.review && L.BANK.history.units[0].qs.some(x => x.q === q.q)), "a unit's first lesson reviews the unit before it");
ok(Array.from({ length: 20 }, () => new Set(L.lessonQuestions('english', 1, 1).map(q => q.kind)).size).every(n => n >= 3), 'a lesson mixes at least 3 kinds of questions');

// generated paths with lessons
const path = { id: 't', lessonsPerUnit: 2, units: [{ title: 'u', lessons: [{ title: 'a', qs: hist.lessons[0].qs }, { title: 'b', qs: hist.lessons[1].qs }] }] };
const pq = L.pathLessonQuestions(path, 0, 1);
ok(pq.length === 5 && pq.filter(q => q.review).length === 1 && pq.filter(q => !q.review).every(q => own.has(q.q)), 'a generated path works the same way');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
