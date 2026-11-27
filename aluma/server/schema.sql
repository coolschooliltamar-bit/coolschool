-- Aluma D1 schema (prototype). The full model is in aluma-spec/03-database.md.
-- Only data of real Google accounts is stored; demo accounts stay in the browser.
CREATE TABLE IF NOT EXISTS users (
  sub        TEXT PRIMARY KEY,          -- Google account id (no name, no e-mail stored)
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_docs (
  user_sub   TEXT NOT NULL,
  collection TEXT NOT NULL,             -- convs | memories | settings | game
  data       TEXT NOT NULL,             -- JSON
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_sub, collection)
);
CREATE TABLE IF NOT EXISTS usage (
  key   TEXT NOT NULL,                  -- u:<sub> | ip:<address> | total
  day   TEXT NOT NULL,                  -- YYYY-MM-DD (UTC)
  count INTEGER NOT NULL,
  PRIMARY KEY (key, day)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_sub TEXT NOT NULL,
  action   TEXT NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_by_user ON audit_log (user_sub, at);
CREATE TABLE IF NOT EXISTS class_members (   -- opt-in rewards profile shared with one Classroom course
  course_id  TEXT NOT NULL,
  user_sub   TEXT NOT NULL,
  profile    TEXT NOT NULL,            -- JSON: first name, level, card ids, badges (no XP, no grades)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (course_id, user_sub)
);
CREATE TABLE IF NOT EXISTS router_votes (     -- shared learning of the fast-answer router (single word stems only)
  word   TEXT NOT NULL,                -- a word stem, or ~skeleton
  intent TEXT NOT NULL,                -- grades | assignments | …
  voter  TEXT NOT NULL,                -- HMAC of the Google account / network – no e-mail, no IP
  vote   INTEGER NOT NULL,             -- +1 taught, -1 "not what I asked"
  at     TEXT NOT NULL,
  PRIMARY KEY (word, intent, voter)
);
CREATE TABLE IF NOT EXISTS card_trades (      -- card trading offers between members of one Classroom course
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL,
  from_sub   TEXT NOT NULL,
  to_sub     TEXT NOT NULL,
  give       TEXT NOT NULL,            -- JSON card ids the sender gives (1–3)
  want       TEXT NOT NULL,            -- JSON card ids the sender asks for (1–3)
  status     TEXT NOT NULL,            -- pending | accepted | declined | cancelled | expired
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_from ON card_trades (from_sub, status);
CREATE INDEX IF NOT EXISTS trades_to ON card_trades (to_sub, status);

-- pilot metrics (aggregates only): how much Aluma is used, per day – no person, question text or IP is stored
CREATE TABLE IF NOT EXISTS metrics (
  day   TEXT NOT NULL,                  -- YYYY-MM-DD (UTC)
  event TEXT NOT NULL,                  -- visit | question_fast | question_ai | lesson_done | path_created | tool_used | reminders_opened
  mode  TEXT NOT NULL,                  -- live (Google account) | demo
  count INTEGER NOT NULL,
  PRIMARY KEY (day, event, mode)
);
CREATE TABLE IF NOT EXISTS metrics_users (   -- one row per active user per day; uh is an HMAC that includes the day
  day  TEXT NOT NULL,
  mode TEXT NOT NULL,
  uh   TEXT NOT NULL,
  PRIMARY KEY (day, mode, uh)
);
