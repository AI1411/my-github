-- v5_releases: cache of GitHub releases for watched repositories.
-- `id` is the GitHub release ID (globally unique).

CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  tag_name TEXT NOT NULL,
  name TEXT,
  prerelease INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  html_url TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX idx_releases_published_at ON releases(published_at);
