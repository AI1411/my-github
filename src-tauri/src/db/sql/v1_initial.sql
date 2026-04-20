-- v1_initial: create baseline tables for Pulse.
-- Source of truth: docs/requirments.md §7 "データモデル (SQLite)".

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL DEFAULT 'github.com',
  avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE repos (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  full_name TEXT NOT NULL,
  is_watched INTEGER NOT NULL DEFAULT 1,
  default_branch TEXT,
  etag TEXT,
  last_fetched_at TEXT,
  UNIQUE(account_id, full_name)
);

CREATE TABLE pulls (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  is_draft INTEGER NOT NULL DEFAULT 0,
  author_login TEXT,
  head_ref TEXT,
  base_ref TEXT,
  ci_state TEXT,
  review_state TEXT,
  has_mention INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  author_login TEXT,
  labels TEXT,
  assignees TEXT,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE TABLE checks (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  pull_id INTEGER REFERENCES pulls(id),
  run_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  started_at TEXT,
  completed_at TEXT,
  html_url TEXT
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  thread_id TEXT NOT NULL,
  subject_type TEXT,
  subject_title TEXT,
  reason TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, thread_id)
);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
