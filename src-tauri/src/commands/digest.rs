use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::commands::releases::ReleaseSummary;
use crate::db::SqlitePool;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestPullItem {
    pub repo: String,
    pub number: i64,
    pub title: String,
    pub html_url: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestNotificationItem {
    pub repo: Option<String>,
    pub title: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestData {
    pub merged_pulls: Vec<DigestPullItem>,
    pub ci_failures: Vec<DigestPullItem>,
    pub review_requests: Vec<DigestNotificationItem>,
    pub mentions: Vec<DigestNotificationItem>,
    pub releases: Vec<ReleaseSummary>,
}

fn get_active_account_db_id(pool: &SqlitePool) -> Option<i64> {
    let conn = pool.get().ok()?;
    conn.query_row(
        "SELECT id FROM accounts WHERE is_active = 1 LIMIT 1",
        [],
        |row| row.get(0),
    )
    .ok()
}

fn pull_rows(
    pool: &SqlitePool,
    since: &str,
    where_clause: &str,
) -> Vec<(String, i64, String, String, String)> {
    let Ok(conn) = pool.get() else {
        return Vec::new();
    };
    let sql = format!(
        "SELECT r.full_name, p.number, p.title, p.raw_json, p.updated_at
         FROM pulls p JOIN repos r ON r.id = p.repo_id
         WHERE p.updated_at >= ?1 AND {where_clause}
         ORDER BY p.updated_at DESC
         LIMIT 50",
    );
    let Ok(mut stmt) = conn.prepare(&sql) else {
        return Vec::new();
    };
    stmt.query_map([since], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
        ))
    })
    .map(|rows| rows.filter_map(Result::ok).collect())
    .unwrap_or_default()
}

fn html_url_from_raw(raw: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|v| v["html_url"].as_str().map(String::from))
}

/// Pulls merged after `since`, judged by `merged_at` in the cached raw JSON.
fn merged_pulls_since(pool: &SqlitePool, since: &str) -> Vec<DigestPullItem> {
    pull_rows(pool, since, "p.state != 'open'")
        .into_iter()
        .filter_map(|(repo, number, title, raw, updated_at)| {
            let merged_at = serde_json::from_str::<serde_json::Value>(&raw)
                .ok()
                .and_then(|v| v["merged_at"].as_str().map(String::from))?;
            if merged_at.as_str() < since {
                return None;
            }
            Some(DigestPullItem {
                repo,
                number,
                title,
                html_url: html_url_from_raw(&raw),
                updated_at,
            })
        })
        .collect()
}

fn ci_failures_since(pool: &SqlitePool, since: &str) -> Vec<DigestPullItem> {
    pull_rows(pool, since, "p.ci_state = 'failure'")
        .into_iter()
        .map(|(repo, number, title, raw, updated_at)| DigestPullItem {
            repo,
            number,
            title,
            html_url: html_url_from_raw(&raw),
            updated_at,
        })
        .collect()
}

fn review_requests_since(
    pool: &SqlitePool,
    account_id: i64,
    since: &str,
) -> Vec<DigestNotificationItem> {
    notifications_since(pool, account_id, since, "review_requested")
}

fn mentions_since(pool: &SqlitePool, account_id: i64, since: &str) -> Vec<DigestNotificationItem> {
    notifications_since(pool, account_id, since, "mention")
}

fn notifications_since(
    pool: &SqlitePool,
    account_id: i64,
    since: &str,
    reason: &str,
) -> Vec<DigestNotificationItem> {
    let Ok(conn) = pool.get() else {
        return Vec::new();
    };
    let Ok(mut stmt) = conn.prepare(
        "SELECT repo_full_name, subject_title, updated_at
         FROM notifications
         WHERE account_id = ?1 AND reason = ?2 AND updated_at >= ?3
         ORDER BY updated_at DESC
         LIMIT 50",
    ) else {
        return Vec::new();
    };
    stmt.query_map(rusqlite::params![account_id, reason, since], |row| {
        Ok(DigestNotificationItem {
            repo: row.get(0)?,
            title: row.get(1)?,
            updated_at: row.get(2)?,
        })
    })
    .map(|rows| rows.filter_map(Result::ok).collect())
    .unwrap_or_default()
}

fn releases_since(pool: &SqlitePool, account_id: i64, since: &str) -> Vec<ReleaseSummary> {
    crate::cache::releases::list_recent_releases(pool, account_id, 50)
        .map(|rows| {
            rows.into_iter()
                .filter(|r| r.published_at.as_deref().is_some_and(|p| p >= since))
                .map(ReleaseSummary::from)
                .collect()
        })
        .unwrap_or_default()
}

/// Summarize what happened since `since` (ISO8601 UTC) using local cache only.
#[tauri::command]
pub async fn cmd_get_digest<R: Runtime>(
    app: AppHandle<R>,
    since: String,
) -> Result<DigestData, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
    Ok(DigestData {
        merged_pulls: merged_pulls_since(pool.inner(), &since),
        ci_failures: ci_failures_since(pool.inner(), &since),
        review_requests: review_requests_since(pool.inner(), account_db_id, &since),
        mentions: mentions_since(pool.inner(), account_db_id, &since),
        releases: releases_since(pool.inner(), account_db_id, &since),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use std::path::Path;

    fn test_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-07-16T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (10, 1, 'octocat/hello', 1)",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    fn insert_pull(
        pool: &SqlitePool,
        number: i64,
        state: &str,
        ci_state: Option<&str>,
        merged_at: Option<&str>,
        updated_at: &str,
    ) {
        let conn = pool.get().unwrap();
        let raw = match merged_at {
            Some(m) => format!(
                r#"{{"html_url":"https://github.com/octocat/hello/pull/{number}","merged_at":"{m}"}}"#
            ),
            None => format!(r#"{{"html_url":"https://github.com/octocat/hello/pull/{number}"}}"#),
        };
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, ci_state, raw_json, updated_at, fetched_at)
             VALUES (10, ?1, ?2, ?3, 0, ?4, ?5, ?6, ?6)",
            rusqlite::params![number, format!("PR {number}"), state, ci_state, raw, updated_at],
        )
        .unwrap();
    }

    #[test]
    fn merged_pulls_since_filters_by_merged_at() {
        let pool = test_pool();
        insert_pull(
            &pool,
            1,
            "closed",
            None,
            Some("2026-07-15T12:00:00Z"),
            "2026-07-15T12:00:00Z",
        );
        insert_pull(
            &pool,
            2,
            "closed",
            None,
            Some("2026-07-01T00:00:00Z"),
            "2026-07-15T12:00:00Z",
        );
        insert_pull(&pool, 3, "closed", None, None, "2026-07-15T12:00:00Z");
        let items = merged_pulls_since(&pool, "2026-07-14T00:00:00Z");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].number, 1);
        assert_eq!(
            items[0].html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/1")
        );
    }

    #[test]
    fn ci_failures_since_filters_by_updated_at() {
        let pool = test_pool();
        insert_pull(
            &pool,
            1,
            "open",
            Some("failure"),
            None,
            "2026-07-15T12:00:00Z",
        );
        insert_pull(
            &pool,
            2,
            "open",
            Some("failure"),
            None,
            "2026-07-01T00:00:00Z",
        );
        insert_pull(
            &pool,
            3,
            "open",
            Some("success"),
            None,
            "2026-07-15T12:00:00Z",
        );
        let items = ci_failures_since(&pool, "2026-07-14T00:00:00Z");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].number, 1);
    }

    #[test]
    fn review_requests_since_reads_notifications() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, reason, subject_title, is_read, updated_at, repo_full_name)
             VALUES (1, 't1', 'review_requested', 'Review me', 0, '2026-07-15T12:00:00Z', 'octocat/hello'),
                    (1, 't2', 'mention', 'Not a review', 0, '2026-07-15T12:00:00Z', 'octocat/hello'),
                    (1, 't3', 'review_requested', 'Old', 0, '2026-07-01T00:00:00Z', 'octocat/hello')",
            [],
        )
        .unwrap();
        drop(conn);
        let items = review_requests_since(&pool, 1, "2026-07-14T00:00:00Z");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title.as_deref(), Some("Review me"));
    }

    #[test]
    fn mentions_since_reads_notifications() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, reason, subject_title, is_read, updated_at, repo_full_name)
             VALUES (1, 't1', 'mention', 'Hey you', 0, '2026-07-15T12:00:00Z', 'octocat/hello'),
                    (1, 't2', 'review_requested', 'Not a mention', 0, '2026-07-15T12:00:00Z', 'octocat/hello')",
            [],
        )
        .unwrap();
        drop(conn);
        let items = mentions_since(&pool, 1, "2026-07-14T00:00:00Z");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title.as_deref(), Some("Hey you"));
    }

    #[test]
    fn releases_since_filters_by_published_at() {
        let pool = test_pool();
        let release = crate::github::types::Release {
            id: 1,
            tag_name: "v1.0.0".into(),
            name: None,
            draft: false,
            prerelease: false,
            published_at: Some("2026-07-15T00:00:00Z".into()),
            html_url: "https://github.com/octocat/hello/releases/tag/v1.0.0".into(),
        };
        crate::cache::releases::upsert_release(&pool, 10, &release, "0").unwrap();
        assert_eq!(releases_since(&pool, 1, "2026-07-14T00:00:00Z").len(), 1);
        assert_eq!(releases_since(&pool, 1, "2026-07-16T00:00:00Z").len(), 0);
    }
}
