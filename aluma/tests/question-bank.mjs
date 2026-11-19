// A large bank of questions people are likely to ask Aluma – generated from templates × slots × variations.
// Every question has the place it should go: a fast-engine topic, or 'ai' (the language model).
// Templates are split: train templates teach the router (tools/train-router.mjs), test templates measure it.
// Slots: {s} "בהיסטוריה" · {sn} "היסטוריה" · {ls} "להיסטוריה" · {d} a day · {k} a child (parents) · {c} a class (teachers)
const MY = { history: ['היסטוריה'], math: ['מתמטיקה', 'מתמטיקה', 'חשבון'], english: ['אנגלית'], science: ['מדעים', 'ביולוגיה'], literature: ['ספרות'], hebrew: ['לשון'], bible: ['תנ״ך', 'תנך'], pe: ['חינוך גופני', 'חנ״ג', 'ספורט'] };
const OTHER = ['כימיה', 'ערבית', 'צרפתית', 'גיאוגרפיה', 'אזרחות', 'מחשבים', 'מוזיקה', 'כלכלה', 'אמנות', 'פסיכולוגיה'];
const DAYS = ['היום', 'מחר', 'ביום ראשון', 'ביום שני', 'ביום שלישי', 'ביום רביעי', 'ביום חמישי', 'מחרתיים'];
const KIDS = ['דנה', 'יואב'];
const CLASSES = ['בט׳2', 'בט2', 'בכיתה ט2', 'בט׳ 2'];

// [template, topic] – topic 'ai' = must go to the language model
const STUDENT = [
  // grades
  ['כמה קיבלתי {s}?', 'grades'], ['מה הציון שלי {s}', 'grades'], ['מה קיבלתי במבחן {s}', 'grades'], ['ציון {s}', 'grades'], ['הציונים שלי {s}', 'grades'],
  ['מה הציון האחרון שלי {s}?', 'grades'], ['איזה ציון קיבלתי {s}', 'grades'], ['יש לי ציון חדש {s}?', 'grades'], ['קיבלתי כבר ציון {s}?', 'grades'], ['מה יצא לי במבחן {s}', 'grades'],
  ['כמה הוצאתי {s}', 'grades'], ['איך הלך לי במבחן {s}?', 'grades'], ['תראי לי את הציונים {s}', 'grades'], ['מה עם הציון שלי {s}?', 'grades'], ['הציון שלי בבוחן {s}', 'grades'],
  ['מה קיבלתי בעבודה {s}', 'grades'], ['כל הציונים שלי {s}', 'grades'], ['ציונים אחרונים {s}', 'grades'], ['מה הציונים שלי', 'grades'], ['יש ציונים חדשים?', 'grades'],
  ['מה הציון הכי גבוה שלי', 'grades'], ['מה הציון הכי נמוך שלי?', 'grades'], ['הציון הכי טוב שלי', 'grades'], ['רוצה לראות את הציונים שלי', 'grades'], ['מה קיבלתי במבחן האחרון', 'grades'],
  ['איזה ציונים יש לי {s}', 'grades'], ['כמה קבלתי {s}', 'grades'], ['הציון במבחן האחרון {s}', 'grades'], ['מה הציון שקיבלתי {s}?', 'grades'], ['קיבלתי ציון {s}?', 'grades'],
  // average
  ['מה הממוצע שלי {s}', 'average'], ['כמה הממוצע שלי {s}?', 'average'], ['ממוצע {s}', 'average'], ['מה הממוצע שלי', 'average'], ['הממוצע הכללי שלי', 'average'],
  ['באיזה מקצוע הממוצע שלי הכי גבוה', 'average'], ['באיזה מקצוע אני הכי חלשה', 'average'], ['מה המקצוע הכי חזק שלי?', 'average'], ['באיזה מקצוע אני הכי טוב', 'average'], ['מה הממוצע שלי בכל המקצועות', 'average'],
  ['תחשבי לי ממוצע {s}', 'average'], ['מה הממוצע {s} שלי', 'average'],
  // assignments
  ['מה יש לי להגיש {s}?', 'assignments'], ['יש לי מטלות {s}', 'assignments'], ['יש שיעורי בית {s}?', 'assignments'], ['מה המטלה {s}', 'assignments'], ['מתי צריך להגיש את העבודה {s}?', 'assignments'],
  ['הגשתי את המטלה {s}?', 'assignments'], ['מה עם העבודה {s}', 'assignments'], ['עד מתי להגיש {s}', 'assignments'], ['מה להגיש השבוע', 'assignments'], ['מה להגיש מחר?', 'assignments'],
  ['יש לי מטלות באיחור', 'assignments'], ['מה לא הגשתי', 'assignments'], ['כמה מטלות פתוחות יש לי?', 'assignments'], ['מטלות פתוחות {s}', 'assignments'], ['מה שיעורי הבית שלי', 'assignments'],
  ['יש משהו להגיש {s}?', 'assignments'], ['מתי ההגשה {s}', 'assignments'], ['מה הדדליין {s}?', 'assignments'], ['יש לי עבודות להגיש', 'assignments'], ['מטלות שעוד לא הגשתי', 'assignments'],
  ['מה צריך להגיש {s} השבוע', 'assignments'], ['שיעורי בית למחר {s}', 'assignments'], ['מה המטלות שלי', 'assignments'], ['אילו מטלות יש לי השבוע?', 'assignments'], ['הגשתי הכול?', 'assignments'],
  // schedule
  ['מה יש לי {d}?', 'schedule'], ['מה המערכת שלי {d}', 'schedule'], ['איזה שיעורים יש לי {d}', 'schedule'], ['מערכת שעות {d}', 'schedule'], ['יש לי לימודים {d}?', 'schedule'],
  ['מה השיעור הבא?', 'schedule'], ['מה יש לי עכשיו', 'schedule'], ['מתי יש לי {sn}?', 'schedule'], ['מתי השיעור הבא {s}', 'schedule'], ['באיזה שעה מתחילים {d}?', 'schedule'],
  ['מתי נגמרים הלימודים {d}', 'schedule'], ['יש שינויים במערכת {d}?', 'schedule'], ['באיזה חדר השיעור הבא', 'schedule'], ['מתי אני מסיימת {d}', 'schedule'], ['יש ביטולים {d}?', 'schedule'],
  ['מה השיעור הראשון {d}', 'schedule'], ['באיזו שעה אני מתחילה {d}', 'schedule'], ['איזה שיעור יש עכשיו?', 'schedule'], ['מה המערכת {d}', 'schedule'], ['תראי לי את המערכת {d}', 'schedule'],
  // attendance
  ['כמה היעדרויות יש לי?', 'attendance'], ['כמה פעמים איחרתי', 'attendance'], ['כמה חיסרתי החודש', 'attendance'], ['מה הנוכחות שלי', 'attendance'], ['יש לי חיסורים?', 'attendance'],
  ['כמה ימים נעדרתי', 'attendance'], ['כמה איחורים יש לי?', 'attendance'], ['היעדרויות החודש', 'attendance'], ['חיסרתי השבוע?', 'attendance'], ['מה המצב שלי בנוכחות', 'attendance'],
  // announcements
  ['מה ההודעות?', 'announcements'], ['יש הודעות חדשות', 'announcements'], ['מה המורה כתבה?', 'announcements'], ['מה שלחו המורים', 'announcements'], ['עדכונים מבית הספר', 'announcements'],
  ['מה ההודעה האחרונה', 'announcements'], ['יש עדכון חדש?', 'announcements'], ['מה המחנכת כתבה', 'announcements'], ['הודעות מהמורים', 'announcements'], ['מה חדש בבית הספר?', 'announcements'],
  // teachers
  ['מי המורה שלי {ls}?', 'teachers'], ['מי מלמד אותי {sn}', 'teachers'], ['מי המחנכת שלי', 'teachers'], ['מי המורים שלי?', 'teachers'], ['איך קוראים למורה {ls}', 'teachers'],
  ['מי המורה {ls}', 'teachers'], ['מי מלמדת {sn}?', 'teachers'], ['מי המחנך שלי?', 'teachers'],
  // progress / rewards
  ['כמה XP יש לי?', 'progress'], ['באיזו רמה אני', 'progress'], ['כמה קלפים יש לי', 'progress'], ['יש לי תיבות לפתוח?', 'progress'], ['כמה נקודות צברתי', 'progress'],
  ['מה ההישגים שלי', 'progress'], ['מה הרמה שלי?', 'progress'], ['כמה xp צברתי', 'progress'], ['כמה קלפים אספתי', 'progress'], ['כמה תיבות יש לי', 'progress'],
  // small talk
  ['תודה', 'thanks'], ['תודה רבה', 'thanks'], ['אחלה תודה', 'thanks'], ['סבבה', 'thanks'], ['מעולה', 'thanks'], ['אוקיי תודה', 'thanks'], ['יופי', 'thanks'], ['הבנתי', 'thanks'],
  ['היי', 'hello'], ['שלום', 'hello'], ['בוקר טוב', 'hello'], ['ערב טוב', 'hello'], ['מה נשמע', 'hello'], ['מי את?', 'hello'], ['מה את יודעת לעשות', 'hello'], ['הי אלומה', 'hello'],
  // must go to the language model
  ['איך לשפר את הציון {s}?', 'ai'], ['למה קיבלתי ציון נמוך {s}', 'ai'], ['תסבירי לי את החומר {s}', 'ai'], ['תעזרי לי עם המטלה {s}', 'ai'], ['מה כדאי ללמוד למבחן {s}', 'ai'],
  ['אני לא מבינה כלום {s}', 'ai'], ['{sn} קשה לי', 'ai'], ['תכיני לי מבחן תרגול {s}', 'ai'], ['מה הנושאים למבחן {s}?', 'ai'], ['המורה {ls} לא הוגנת', 'ai'],
  ['תכתבי לי עבודה {s}', 'ai'], ['יש לי מבחן {s} מחר ואני לחוצה', 'ai'], ['מתי המבחן הבא {s}?', 'ai'], ['כמה קיבל איתי {s}?', 'ai'], ['תפתרי לי את השאלה {s}', 'ai'],
  ['איך מתכוננים למבחן {s}', 'ai'], ['מה זה ממוצע משוקלל', 'ai'], ['איזה ציון צריך כדי לעבור', 'ai'], ['הציון שלי לא הוגן', 'ai'], ['למה המורה לא החזירה את המבחן?', 'ai'],
  ['מה דעתך על הציונים שלי', 'ai'], ['תני לי טיפים ללמידה', 'ai'], ['אני עצובה מהציון', 'ai'], ['מה עושים אם שכחתי להגיש', 'ai'], ['אפשר לדחות את ההגשה {s}?', 'ai'],
  ['איך כותבים את העבודה {s}', 'ai'], ['מה המטלה {s} דורשת?', 'ai'], ['תסכמי לי את ההודעות', 'ai'], ['כמה זה 12 כפול 13', 'ai'], ['מה הבירה של צרפת', 'ai'],
  ['ספרי לי בדיחה', 'ai'], ['מי ניצח במשחק אתמול?', 'ai'], ['מה זה פוטוסינתזה', 'ai'], ['כמה קיבלה רוני {s}', 'ai'], ['האם הציון שלי {s} טוב?', 'ai'],
  ['קיבלתי 60 {s}, זה נכשל?', 'ai'], ['למה יש לי כל כך הרבה מטלות?', 'ai'], ['אני לא מספיקה להגיש הכול', 'ai'], ['איך מחשבים ממוצע?', 'ai'], ['מה ההבדל בין בוחן למבחן?', 'ai'],
  ['תמליצי לי איך ללמוד {sn}', 'ai'], ['מה הסיכוי שאעבור את הבגרות {s}', 'ai'], ['תעזרי לי לבנות לוח זמנים ללמידה', 'ai'], ['למה השיעור {s} בוטל?', 'ai'], ['אני מפחדת מהמבחן {s}', 'ai'],
];
const PARENT = [
  ['מה המצב של {k}?', 'weekly'], ['איך {k} בלימודים?', 'weekly'], ['סיכום שבועי של {k}', 'weekly'], ['מה שלום {k} בבית הספר?', 'weekly'], ['מה המצב עם {k}', 'weekly'],
  ['מה הציונים של {k}?', 'grades'], ['כמה קיבל{a} {k} {s}', 'grades'], ['מה הציון של {k} {s}', 'grades'], ['יש ל{k} ציון חדש?', 'grades'], ['הציונים האחרונים של {k}', 'grades'],
  ['מה הממוצע של {k}', 'average'], ['מה הממוצע של {k} {s}?', 'average'], ['יש ל{k} מטלות פתוחות?', 'assignments'], ['מה {k} צריך להגיש השבוע?', 'assignments'], ['יש ל{k} שיעורי בית?', 'assignments'],
  ['כמה היעדרויות יש ל{k}?', 'attendance'], ['כמה פעמים {k} איחר{a}', 'attendance'], ['מה יש ל{k} {d}', 'schedule'], ['מה המערכת של {k} {d}?', 'schedule'], ['מי המחנכת של {k}?', 'teachers'],
  ['מי המורה של {k} {ls}', 'teachers'], ['מה ההודעות מבית הספר?', 'announcements'], ['תודה', 'thanks'],
  ['איך לעזור ל{k} {s}?', 'ai'], ['{k} מקבל{a} ציונים נמוכים, מה לעשות?', 'ai'], ['למה {k} נעדר{a} כל כך הרבה?', 'ai'], ['תנסחי למחנכת ש{k} חולה', 'ai'], ['איך לדבר עם {k} על הציונים', 'ai'],
  ['האם {k} צריך מורה פרטי {ls}?', 'ai'], ['מה הציון של נועה {s}', 'ai'],
];
const TEACHER = [
  ['מי לא הגיש {c}?', 'class_missing'], ['מי לא הגיש את העבודה {c}', 'class_missing'], ['מי עוד לא הגיש {c}', 'class_missing'], ['מה הממוצע במבחן האחרון {c}?', 'class_exam'], ['ממוצע המבחן {c}', 'class_exam'],
  ['מה ממוצע הכיתה {c}', 'class_exam'], ['מי עם יותר מ-3 היעדרויות {c}?', 'class_attendance'], ['היעדרויות {c}', 'class_attendance'], ['יש לי הודעות חדשות?', 'inbox'], ['כמה הודעות יש לי', 'inbox'],
  ['מה בתיבת ההודעות', 'inbox'], ['תודה', 'thanks'], ['בוקר טוב', 'hello'],
  ['איך לשפר את הממוצע {c}?', 'ai'], ['תנסחי הודעה להורים {c}', 'ai'], ['תכיני לי מבחן על המהפכה הצרפתית', 'ai'], ['איך להסביר את החומר לכיתה', 'ai'], ['למה הכיתה {c} נכשלה?', 'ai'],
];
const PREFIX = ['', '', '', '', 'תגידי לי ', 'אלומה, ', 'רציתי לדעת ', 'אפשר לדעת ', 'היי, ', 'שאלה: '];
const SUFFIX = ['', '', '', '?', ' בבקשה', ' תודה', '??', '!'];

function rng(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; }
// a real Hebrew misspelling: drop one ו / י from a long word (full ↔ defective spelling)
function typo(q, R) {
  const w = q.split(' '); const i = w.findIndex((x, k) => k >= Math.floor(R() * w.length) && x.length >= 6 && /[וי]/.test(x.slice(1, -1)));
  if (i < 0) return q; const x = w[i]; const j = x.slice(1, -1).search(/[וי]/) + 1; w[i] = x.slice(0, j) + x.slice(j + 1); return w.join(' ');
}
const subjects = () => [...Object.entries(MY).flatMap(([id, names]) => names.map(n => ({ id, n }))), ...OTHER.map(n => ({ id: 'x:' + n, n }))];
const bet = n => (/^[הו]/.test(n) ? 'ב' + n : 'ב' + n), lamed = n => 'ל' + n;

export function generate({ split = 'all', perTemplate = 6, seed = 7 } = {}) {
  const R = rng(seed); const out = [];
  const add = (uid, list) => list.forEach(([tpl, topic], ti) => {
    const isTest = ti % 4 === 3;                                    // every 4th template is held out
    if ((split === 'train' && isTest) || (split === 'test' && !isTest)) return;
    for (let n = 0; n < (/\{/.test(tpl) ? perTemplate : 2); n++) {
      const sub = subjects()[Math.floor(R() * subjects().length)];
      const kid = KIDS[Math.floor(R() * KIDS.length)];
      let q = tpl.replace('{s}', bet(sub.n)).replace('{sn}', sub.n).replace('{ls}', lamed(sub.n)).replace('{d}', DAYS[Math.floor(R() * DAYS.length)])
        .replace(/\{k\}/g, kid).replace(/\{a\}/g, kid === 'דנה' ? 'ה' : '').replace('{c}', CLASSES[Math.floor(R() * CLASSES.length)]);
      if (topic !== 'thanks' && topic !== 'hello') { q = PREFIX[Math.floor(R() * PREFIX.length)] + q; if (!/[?!]$/.test(q)) q += SUFFIX[Math.floor(R() * SUFFIX.length)]; }
      if (R() < 0.15) q = typo(q, R);
      out.push({ uid, q, topic, subject: /\{s\}|\{sn\}|\{ls\}/.test(tpl) ? sub : null, kid: /\{k\}/.test(tpl) ? kid : null, tpl });
    }
  });
  add('u-noa', STUDENT); add('u-yoav', STUDENT.filter(([t]) => !/איתי|רוני/.test(t))); add('u-avi', PARENT); add('u-rina', TEACHER);
  const seen = new Set(); return out.filter(x => !seen.has(x.uid + x.q) && seen.add(x.uid + x.q));
}
