-- v8_notifications_subject_url: cache the GitHub API subject URL so cross-account
-- inbox items (built from cache only, without a live per-account fetch) can derive
-- an html_url and PR/issue number.
ALTER TABLE notifications ADD COLUMN subject_url TEXT;
