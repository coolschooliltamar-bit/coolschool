# יומן שינויי אבטחה – אלומה

כל שינוי אבטחה מתועד כאן. הדוח המלא: [`aluma-spec/19-security-compliance.md`](../aluma-spec/19-security-compliance.md).

## 19.11.2026 – ענף `security-hardening` (לא מוזג, לא נפרס)

| # | שינוי | קבצים | למה | בדיקה |
|---|---|---|---|---|
| 1 | מודול אבטחה חדש | `js/security.js` | קישורים בטוחים, בדיקת קבצים, ניקוי טקסט, גידור תוכן חיצוני, כינויים במקום שמות | `tests/security-test.mjs` |
| 2 | שמות לא נשלחים למודל ה-AI | `js/gemini.js` | הגנה על מידע אישי (F14) | security-test §5, ובדיקה מול Gemini האמיתי עם נתוני דמה |
| 3 | רשימת היתרים לכלים לפי תפקיד | `js/gemini.js` | הגנה בשכבות (F5) | security-test §6 |
| 4 | גידור תוכן חיצוני | `js/gemini.js`, `js/studio.js`, `js/app.js` | Prompt Injection (F21) | security-test §4 |
| 5 | בדיקת קבצים לפי חתימת תוכן | `js/studio.js` | קבצים מזויפים (F13) | security-test §3, e2e §1 |
| 6 | `safeUrl` לכל קישור חיצוני | `js/app.js`, `js/views.js` | חסימת `javascript:` (F15) | e2e §2–3 |
| 7 | CSP ו-Referrer-Policy, הוצאת הסקריפט המוטמע ל-`js/theme.js` | `index.html`, `js/theme.js` | צמצום XSS (F16) | e2e §1 |
| 8 | מתג `DEMO_ACCOUNTS`, ניתוק אחרי `IDLE_MINUTES` | `js/config.js`, `js/app.js` | התחברות והפעלות (F1, F2) | e2e §6 |
| 9 | `forgetUser`: מחיקה מקומית בהתנתקות של חשבון אמיתי | `js/store.js`, `js/app.js` | מחשבים משותפים (F3) | e2e §4 |
| 10 | כפתור מחיקת חשבון: אישור בהקלדה, ביטול הרשאות Google, הודעה כשהשרת נכשל | `js/app.js`, `js/cloud.js`, `css/app.css` | מחיקה (F17) | e2e §5 |
| 11 | שרת: מקורות לפי סביבה, כותרות אבטחה, `no-store`, 400 לקלט שבור | `server/worker.js` | הגנת API (F8–F10) | security-test §7 |
| 12 | שרת: מחיקת חשבון מכל הטבלאות, **ותיקון באג: `/db/me` החזיר 404 ולא מחק** | `server/worker.js` | מחיקה (F17) | security-test §7 |
| 13 | שרת: `ROUTER_SALT` נפרד, משימת שמירה (`scheduled`) | `server/worker.js` | סודות ושמירת נתונים (F18, F24) | security-test §7 |
| 14 | בדיקות אוטומטיות חדשות | `tests/security-test.mjs`, `tests/e2e-security.cjs` | שלב 4 | 57/57, 23/23 |
| 15 | דוח התאמה | `aluma-spec/19-security-compliance.md` | תיעוד | – |

## 19.11.2026 – סבב 2, אחרי קבלת נספח ג' v1.9 (אותו ענף; לא מוזג ולא נפרס)

| # | שינוי | קבצים | סעיף בנספח | בדיקה |
|---|---|---|---|---|
| 16 | הצפנת AES-256-GCM לנתוני משתמשים ולפרופילי כיתה בשרת (`DATA_KEY`). שורות ישנות ממשיכות להיקרא | `server/worker.js` | 3.5.7, 4.2.1, 4.9.5 | security-test §7b |
| 17 | תיעוד בשרת של קריאה, כתיבה, דחיית התחברות וחסימת חברות | `server/worker.js` | 3.7.1, 4.7.1 | §7b |
| 18 | חיבור מרבי של 8 שעות (`MAX_SESSION_HOURS`) | `js/config.js`, `js/app.js` | 4.1.6 | e2e §7 |
| 19 | safetySettings ברמה המחמירה, ותשובה בטוחה כשהתוכן נחסם | `js/gemini.js` | 4.9.12 | §5 |
| 20 | מגבלת אורך לשאלה (2,000 תווים) | `js/gemini.js`, `js/app.js` | 4.9.14 | e2e §8 |
| 21 | "הורדת המידע שלי": קובץ JSON שהשדה הראשון בו הוא הכיתוב החוקי | `js/security.js`, `js/app.js` | 3.13.1, 3.2.9 | §5b, e2e §8 |
| 22 | טבלת התאמה מלאה מול נספח ג' v1.9 | `aluma-spec/19-security-compliance.md` | כל הסעיפים | – |
