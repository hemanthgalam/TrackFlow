-- TrackFlow schema for Cloudflare D1 (SQLite).
-- contacts and timeline hold JSON arrays as text, mirroring the JSONB columns in Postgres.
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  date_applied TEXT NOT NULL,
  url TEXT,
  salary TEXT,
  location TEXT,
  type TEXT,
  workplace TEXT,
  notes TEXT,
  contacts TEXT NOT NULL DEFAULT '[]',
  timeline TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_date_applied ON jobs (date_applied DESC);
