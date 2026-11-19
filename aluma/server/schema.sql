-- Aluma D1 schema (prototype). The full model is in aluma-spec/03-database.md.
-- Only data of real Google accounts is stored; demo accounts stay in the browser.
CREATE TABLE IF NOT EXISTS users (
  sub        TEXT PRIMARY KEY,          -- Google account id (no name, no e-mail stored)
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_docs (
  user_sub   TEXT NOT NULL,
  collection TEXT NOT NULL,             -- convs | memories | settings
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
