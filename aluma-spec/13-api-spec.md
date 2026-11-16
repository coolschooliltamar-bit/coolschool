# 13 – מפרט API

REST מעל HTTPS, JSON, גרסה בנתיב: `/api/v1`. אימות: עוגיית סשן (Web). כל הבקשות המשנות דורשות כותרת `X-CSRF-Token`.

## פורמט שגיאה אחיד

```json
{ "error": { "code": "forbidden", "message": "אין הרשאה לפעולה זו", "requestId": "req_01J..." } }
```

| HTTP | code | מתי |
|------|------|-----|
| 400 | `invalid_request` | ולידציה נכשלה |
| 401 | `unauthenticated` | אין סשן / פג |
| 403 | `forbidden` | אין הרשאה |
| 404 | `not_found` | לא קיים **או** אין הרשאה לדעת שקיים |
| 409 | `conflict` | פעולה כבר אושרה / פגה |
| 429 | `rate_limited` | חריגה מקצב; כולל `Retry-After` |
| 503 | `upstream_unavailable` | מערכת חיצונית לא זמינה |

## אימות

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/auth/google/start` | הפניה ל-OIDC |
| GET | `/auth/google/callback` | יצירת סשן |
| POST | `/auth/otp/request` | `{ "contact": "..." }` – קוד חד־פעמי להורה |
| POST | `/auth/otp/verify` | `{ "contact", "code" }` |
| POST | `/auth/logout` | |
| POST | `/auth/logout-all` | ניתוק כל המכשירים |

## משתמש

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/me` | פרופיל, תפקידים, תפקיד פעיל, הסכמות |
| POST | `/me/active-role` | `{ "role": "parent" }` |
| GET | `/me/children` | (הורה) ילדים מקושרים וסטטוס |
| POST | `/me/children/link` | (הורה) `{ "code": "AB12CD34" }` |
| GET/DELETE | `/me/memories`, `/me/memories/{id}` | זיכרונות |
| PUT | `/me/settings` | התראות, זיכרון, סגנון, מגדר פנייה |
| DELETE | `/me/conversations` | מחיקת כל ההיסטוריה |

## שיחות

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/conversations` | רשימה (עמודים: `?cursor=`) |
| POST | `/conversations` | `{ "actingForStudentId"?: "..." }` |
| GET | `/conversations/{id}/messages` | הודעות |
| POST | `/conversations/{id}/messages` | שליחת שאלה – תשובה כ-**SSE** |
| POST | `/messages/{id}/feedback` | `{ "rating": "up"|"down", "comment"? }` |

### זרם SSE – אירועים

```
event: status        data: {"text":"מחפשת במשוב..."}
event: delta         data: {"text":"קיבלת "}
event: card          data: {"type":"grade","data":{...},"source":"mashov","fetchedAt":"..."}
event: action        data: {"type":"send_message","actionId":"act_...","draft":{...}}
event: done          data: {"messageId":"msg_..."}
event: error         data: {"code":"upstream_unavailable","message":"..."}
```

## פעולות ממתינות

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/actions/{id}` | טיוטה וסטטוס |
| PATCH | `/actions/{id}` | עריכת הטיוטה `{ "body": "...", "subject": "..." }` |
| POST | `/actions/{id}/confirm` | `{ "confirmToken": "..." }` – שליחה בפועל. אסימון חד־פעמי שהתקבל באירוע `action` |
| POST | `/actions/{id}/cancel` | |
| POST | `/actions/{id}/undo` | ביטול בתוך 10 שניות אחרי שליחה (אם המחבר תומך / ההודעה עדיין בתור) |

## מורים

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/teacher/inbox` | הודעות שהתקבלו, סינון לפי תגית/כיתה |
| POST | `/teacher/inbox/{id}/read` | |
| POST | `/teacher/inbox/{id}/report` | דיווח על הודעה פוגענית |
| PUT | `/teacher/settings` | שעות שקט, סיכום יומי |

## חיבורים

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/connectors` | חיבורים זמינים וסטטוס למשתמש |
| GET | `/connectors/{provider}/connect` | התחלת OAuth |
| GET | `/connectors/{provider}/callback` | |
| DELETE | `/connectors/{provider}` | ניתוק + ביטול טוקן |
| POST | `/connectors/{provider}/sync` | סנכרון ידני (מוגבל ל-1 ל-5 דקות) |

## ניהול בית ספר (`/admin`, תפקיד `school_admin`)

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/admin/dashboard` | מדדים מצרפיים |
| GET/POST | `/admin/users`, `/admin/users/import` | ניהול וייבוא |
| PATCH | `/admin/users/{id}` | השבתה / תפקיד |
| GET | `/admin/parent-links?status=pending` | בקשות קישור |
| POST | `/admin/parent-links/{id}/approve` · `/block` | |
| POST | `/admin/parent-codes` | `{ "studentId" }` → קוד הזמנה |
| GET/PUT | `/admin/policies` | מדיניות |
| GET | `/admin/audit?from=&to=&actor=&student=` | יומן ביקורת |
| POST | `/admin/emergency-stop` | דורש MFA טרי |

## הגבלות קצב

כותרות בכל תשובה: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`. ערכים – ראו 02.

## גרסאות ותאימות

- שינוי שובר → `/api/v2`. שדות חדשים מתווספים בלי לשבור.
- סכמות מוגדרות ב-OpenAPI 3.1 (`openapi.yaml` במאגר), ומשמשות לבדיקות חוזיות.
