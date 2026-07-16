-- v4_inbox_item_state: local pin / snooze state for inbox items.
-- Item IDs are GraphQL node IDs or synthetic IDs (e.g. "ci-{repo}-{number}").

CREATE TABLE inbox_item_state (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  item_id TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  snoozed_until INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, item_id)
);
