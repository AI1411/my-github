use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::types::Notification;
use rusqlite::params;

pub fn upsert_notification(
    pool: &SqlitePool,
    account_id: i64,
    notification: &Notification,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO notifications
             (account_id, thread_id, subject_type, subject_title, reason,
              is_read, updated_at, repo_full_name)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(account_id, thread_id) DO UPDATE SET
             subject_title  = excluded.subject_title,
             reason         = excluded.reason,
             updated_at     = excluded.updated_at,
             repo_full_name = excluded.repo_full_name",
        params![
            account_id,
            notification.id,
            notification.subject.subject_type,
            notification.subject.title,
            notification.reason,
            if notification.unread { 0i32 } else { 1i32 },
            notification.updated_at,
            notification.repository.full_name,
        ],
    )?;
    Ok(())
}

pub fn mark_notification_read(pool: &SqlitePool, thread_id: &str) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE thread_id = ?1",
        params![thread_id],
    )?;
    Ok(())
}

pub fn mark_all_notifications_read(pool: &SqlitePool, account_id: i64) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE account_id = ?1",
        params![account_id],
    )?;
    Ok(())
}

pub struct CachedNotification {
    pub thread_id: String,
    pub subject_type: Option<String>,
    pub subject_title: Option<String>,
    pub reason: Option<String>,
    pub is_read: bool,
    pub updated_at: String,
    pub repo_full_name: Option<String>,
}

pub fn list_notifications_for_account(
    pool: &SqlitePool,
    account_id: i64,
) -> Result<Vec<CachedNotification>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT thread_id, subject_type, subject_title, reason,
                is_read, updated_at, repo_full_name
         FROM notifications
         WHERE account_id = ?1
         ORDER BY updated_at DESC
         LIMIT 200",
    )?;
    let rows = stmt.query_map(params![account_id], |row| {
        Ok(CachedNotification {
            thread_id: row.get(0)?,
            subject_type: row.get(1)?,
            subject_title: row.get(2)?,
            reason: row.get(3)?,
            is_read: row.get::<_, i32>(4)? == 1,
            updated_at: row.get(5)?,
            repo_full_name: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{NotificationSubject, Repository, User};
    use std::path::Path;

    fn test_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-04-21T00:00:00Z')",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    fn sample_repo(full_name: &str) -> Repository {
        Repository {
            id: 1,
            name: full_name.split('/').last().unwrap_or("repo").to_string(),
            full_name: full_name.to_string(),
            private: false,
            owner: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: "".into(),
                html_url: "".into(),
                name: None,
            },
            html_url: format!("https://github.com/{}", full_name),
            description: None,
            fork: false,
            default_branch: "main".into(),
        }
    }

    fn sample_notification(thread_id: &str, reason: &str, unread: bool) -> Notification {
        Notification {
            id: thread_id.to_string(),
            unread,
            reason: reason.to_string(),
            updated_at: "2026-04-21T00:00:00Z".to_string(),
            url: format!("https://api.github.com/notifications/threads/{}", thread_id),
            subject: NotificationSubject {
                title: format!("PR about {}", thread_id),
                url: Some("https://api.github.com/repos/octocat/hello/pulls/1".to_string()),
                latest_comment_url: None,
                subject_type: "PullRequest".to_string(),
            },
            repository: sample_repo("octocat/hello"),
        }
    }

    #[test]
    fn upsert_notification_inserts_new_row() {
        let pool = test_pool();
        let n = sample_notification("thread-1", "review_requested", true);
        upsert_notification(&pool, 1, &n).unwrap();
        let rows = list_notifications_for_account(&pool, 1).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].thread_id, "thread-1");
        assert_eq!(rows[0].reason.as_deref(), Some("review_requested"));
        assert_eq!(rows[0].repo_full_name.as_deref(), Some("octocat/hello"));
    }

    #[test]
    fn upsert_notification_updates_existing_row() {
        let pool = test_pool();
        let n = sample_notification("t1", "mention", true);
        upsert_notification(&pool, 1, &n).unwrap();
        let mut n2 = n.clone();
        n2.subject.title = "Updated title".to_string();
        upsert_notification(&pool, 1, &n2).unwrap();
        let rows = list_notifications_for_account(&pool, 1).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].subject_title.as_deref(), Some("Updated title"));
    }

    #[test]
    fn mark_notification_read_sets_is_read() {
        let pool = test_pool();
        let n = sample_notification("t1", "mention", true);
        upsert_notification(&pool, 1, &n).unwrap();
        mark_notification_read(&pool, "t1").unwrap();
        let rows = list_notifications_for_account(&pool, 1).unwrap();
        assert!(rows[0].is_read);
    }

    #[test]
    fn mark_all_notifications_read_marks_all() {
        let pool = test_pool();
        upsert_notification(&pool, 1, &sample_notification("t1", "mention", true)).unwrap();
        upsert_notification(
            &pool,
            1,
            &sample_notification("t2", "review_requested", true),
        )
        .unwrap();
        mark_all_notifications_read(&pool, 1).unwrap();
        let rows = list_notifications_for_account(&pool, 1).unwrap();
        assert!(rows.iter().all(|r| r.is_read));
    }

    #[test]
    fn list_notifications_orders_by_updated_desc() {
        let pool = test_pool();
        let mut n1 = sample_notification("old", "mention", true);
        n1.updated_at = "2026-04-18T00:00:00Z".to_string();
        let mut n2 = sample_notification("new", "review_requested", true);
        n2.updated_at = "2026-04-21T00:00:00Z".to_string();
        upsert_notification(&pool, 1, &n1).unwrap();
        upsert_notification(&pool, 1, &n2).unwrap();
        let rows = list_notifications_for_account(&pool, 1).unwrap();
        assert_eq!(rows[0].thread_id, "new");
        assert_eq!(rows[1].thread_id, "old");
    }
}
