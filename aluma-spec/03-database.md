# 03 – מבנה בסיס הנתונים

PostgreSQL 16. כל טבלה עם נתוני בית ספר מכילה `tenant_id` ומוגנת ב-Row Level Security. מזהים: UUID v7. זמנים: `timestamptz` (UTC), תצוגה בשעון ישראל.

## תרשים קשרים (מקוצר)

```
tenants ─┬─< users ─┬─< memberships >── classes
         │          ├─< parent_child_links >── users (student)
         │          ├─< connector_accounts
         │          ├─< conversations ─< messages
         │          ├─< pending_actions
         │          ├─< memories / style_profiles
         │          └─< consents
         ├─< records_grades / records_assignments / records_schedule / records_messages
         ├─< connector_configs
         └─< audit_log, usage_events
```

## טבלאות ליבה

### `tenants` – בתי ספר
| עמודה | סוג | הערות |
|-------|-----|-------|
| id | uuid PK | |
| name | text | |
| ministry_school_code | text NULL | סמל מוסד |
| status | enum(`pilot`,`active`,`suspended`) | `suspended` = עצירת חירום |
| settings | jsonb | מדיניות: פיצ'רים פעילים, שעות שקט, תקרת עלות |
| created_at | timestamptz | |

### `users`
| עמודה | סוג | הערות |
|-------|-----|-------|
| id | uuid PK | |
| tenant_id | uuid FK | |
| role | enum(`student`,`parent`,`teacher`,`school_admin`,`aluma_admin`) | תפקיד ראשי |
| display_name | text | |
| email | citext NULL | |
| phone | text NULL | מוצפן ברמת עמודה |
| external_ids | jsonb | `{ "google": "...", "mashov": "..." }` |
| grade_level | smallint NULL | לתלמידים (7–12) |
| birth_year | smallint NULL | לבדיקת בגירות (`Q-08`) |
| status | enum(`invited`,`active`,`disabled`) | |
| created_at, last_login_at | timestamptz | |

### `classes` ו-`memberships`
- `classes(id, tenant_id, name, subject, grade_level, school_year, external_ids)`
- `memberships(id, tenant_id, user_id, class_id, role_in_class enum('student','teacher'))`

### `parent_child_links`
| עמודה | סוג | הערות |
|-------|-----|-------|
| parent_id | uuid FK users | |
| student_id | uuid FK users | |
| status | enum(`pending`,`active`,`blocked`) | `blocked` – בית הספר חסם |
| verified_by | enum(`school_code`,`admin`,`import`) | איך אומת הקשר |
| permissions | jsonb | למשל `{"grades":true,"messages":false}` |
| created_at, verified_at | timestamptz | |

### `connector_configs` ו-`connector_accounts`
- `connector_configs(id, tenant_id, provider enum('demo','google_classroom','mashov','ministry',...), enabled, settings jsonb)` – חיבור ברמת בית ספר.
- `connector_accounts(id, tenant_id, user_id, provider, encrypted_token bytea, token_dek_wrapped bytea, scopes text[], expires_at, status, last_sync_at)` – חיבור ברמת משתמש (OAuth). **הטוקן לעולם לא נחשף ל-AI או ללוגים.**

### רשומות מנורמלות (מטמון ממערכות מקור)
כל הטבלאות כוללות: `tenant_id, student_id, source (provider), source_id, fetched_at, raw_hash`.

| טבלה | שדות עיקריים |
|------|---------------|
| `records_grades` | subject, assessment_type (`exam`,`quiz`,`assignment`,`final`), title, score numeric, max_score, date, teacher_id, comment |
| `records_assignments` | class_id, title, description, due_at, status (`open`,`submitted`,`late`,`graded`), link |
| `records_schedule` | day_of_week / date, start_time, end_time, subject, teacher_id, room, meeting_link, change_note |
| `records_attendance` | date, period, status (`present`,`late`,`absent`,`excused`) |
| `records_messages` | direction, from_user_id, to_user_id, subject, body (מוצפן), sent_at, read_at |

אינדקס ייחודי: `(tenant_id, source, source_id)` – סנכרון חוזר מעדכן ולא משכפל.

### שיחות
- `conversations(id, tenant_id, user_id, acting_for_student_id NULL, title, created_at, archived_at)` – `acting_for_student_id` להורה שמדבר על ילד מסוים.
- `messages(id, conversation_id, tenant_id, role enum('user','assistant','tool'), content jsonb, tool_name NULL, tokens_in, tokens_out, created_at)`

### `pending_actions`
| עמודה | סוג | הערות |
|-------|-----|-------|
| id | uuid PK | |
| tenant_id, user_id | uuid | |
| type | enum(`send_message`) | בהמשך: `add_calendar_event` |
| payload | jsonb | נמען (מזהה מאומת), נושא, גוף |
| status | enum(`draft`,`confirmed`,`sent`,`failed`,`cancelled`,`expired`) | |
| confirm_token_hash | text | אסימון חד־פעמי |
| created_from_external_content | bool | לסימון בכרטיס האישור (T5) |
| expires_at | timestamptz | ברירת מחדל: 30 דקות |
| sent_at, error | | |

### זיכרון והתאמה אישית (ראו 11)
- `memories(id, tenant_id, user_id, kind enum('preference','fact'), text, source_message_id, created_at, expires_at)`
- `style_profiles(user_id, tenant_id, summary text, examples_encrypted bytea, consent_id, updated_at)`

### הסכמות
- `consents(id, tenant_id, user_id, granted_by_user_id, type enum('use_service','style_learning','parent_access','ai_processing'), version, granted_at, revoked_at)`

### ביקורת ושימוש
- `audit_log(id bigserial, tenant_id, actor_user_id, action, target_type, target_id, subject_student_id NULL, ip_hash, user_agent_hash, at)` – הרשאות `INSERT` בלבד לאפליקציה.
- `usage_events(id, tenant_id, user_id, kind, model, input_tokens, output_tokens, cache_read_tokens, cost_usd numeric, at)`

## Row Level Security – דוגמה

```sql
ALTER TABLE records_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON records_grades
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY student_scope ON records_grades
  USING (student_id = ANY (string_to_array(current_setting('app.allowed_student_ids'), ',')::uuid[]));
```

שכבת הנתונים מגדירה `SET LOCAL app.tenant_id` ו-`app.allowed_student_ids` בתחילת כל טרנזקציה, לפי הסשן. משתמש DB של האפליקציה **אינו** בעל הטבלאות ולא יכול לעקוף RLS.

## מדיניות שמירה (הצעה – לאשר משפטית, `Q-13`)

| מידע | זמן שמירה |
|------|-----------|
| רשומות מטמון ממערכות מקור | כל עוד החיבור פעיל; נמחק 30 יום אחרי ניתוק |
| שיחות | 90 יום (המשתמש יכול למחוק מיד) |
| זיכרונות | עד מחיקה ע"י המשתמש או 12 חודשים ללא שימוש |
| פעולות ממתינות שלא אושרו | 30 דקות, ואז נמחק התוכן |
| יומן ביקורת | 2 שנים |
| נתוני שימוש מצרפיים | ללא הגבלה (ללא תוכן) |

## מיגרציות
- כלי: מיגרציות SQL מגורסות בגיט, מורצות ב-CI לפני פריסה.
- אסור לשנות עמודה מוצפנת בלי סקריפט הצפנה מחדש.
