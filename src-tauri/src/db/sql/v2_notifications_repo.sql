-- v2_notifications_repo: add repo_full_name to notifications for display context
ALTER TABLE notifications ADD COLUMN repo_full_name TEXT;
