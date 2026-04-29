CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
