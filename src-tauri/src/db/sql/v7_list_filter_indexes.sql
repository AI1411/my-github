CREATE INDEX IF NOT EXISTS idx_pulls_repo_state ON pulls (repo_id, state);
CREATE INDEX IF NOT EXISTS idx_pulls_author_login ON pulls (author_login);
CREATE INDEX IF NOT EXISTS idx_issues_repo_state ON issues (repo_id, state);
CREATE INDEX IF NOT EXISTS idx_issues_author_login ON issues (author_login);
