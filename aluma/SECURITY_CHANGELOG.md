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
