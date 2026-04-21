use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::list_notifications;
use crate::github::types::Notification;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxItem {
    pub id: String,
    pub kind: String,
    pub repo: String,
    pub number: Option<i64>,
    pub title: String,
    pub html_url: Option<String>,
    pub updated_at: String,
    pub unread: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxData {
    pub review_requests: Vec<InboxItem>,
    pub ci_failures: Vec<InboxItem>,
    pub mentions: Vec<InboxItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationItem {
    pub id: String,
    pub reason: String,
    pub repo: String,
    pub subject_title: String,
    pub subject_type: String,
    pub html_url: Option<String>,
    pub unread: bool,
    pub updated_at: String,
}

fn api_url_to_html(url: &str) -> String {
    url.replace("https://api.github.com/repos/", "https://github.com/")
        .replace("/pulls/", "/pull/")
}

fn notification_to_inbox_item(n: &Notification) -> InboxItem {
    let html_url = n.subject.url.as_deref().map(api_url_to_html);
    InboxItem {
        id: n.id.clone(),
        kind: n.reason.clone(),
        repo: n.repository.full_name.clone(),
        number: None,
        title: n.subject.title.clone(),
        html_url,
        updated_at: n.updated_at.clone(),
        unread: n.unread,
    }
}

fn notification_to_item(n: &Notification) -> NotificationItem {
    let html_url = n.subject.url.as_deref().map(api_url_to_html);
    NotificationItem {
        id: n.id.clone(),
        reason: n.reason.clone(),
        repo: n.repository.full_name.clone(),
        subject_title: n.subject.title.clone(),
        subject_type: n.subject.subject_type.clone(),
        html_url,
        unread: n.unread,
        updated_at: n.updated_at.clone(),
    }
}

fn read_ci_failures(pool: &SqlitePool) -> Result<Vec<InboxItem>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.number, p.title, p.raw_json, r.full_name, p.updated_at
             FROM pulls p
             JOIN repos r ON r.id = p.repo_id
             WHERE p.ci_state = 'failure'
             ORDER BY p.updated_at DESC
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let (number, title, raw, repo, updated_at) = r.map_err(|e| e.to_string())?;
        let html_url = serde_json::from_str::<serde_json::Value>(&raw)
            .ok()
            .and_then(|v| v["html_url"].as_str().map(String::from));
        out.push(InboxItem {
            id: format!("ci-{}-{}", repo, number),
            kind: "ci_failure".to_string(),
            repo,
            number: Some(number),
            title,
            html_url,
            updated_at,
            unread: true,
        });
    }
    Ok(out)
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

#[tauri::command]
pub async fn cmd_get_inbox<R: Runtime>(app: AppHandle<R>) -> Result<InboxData, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let notifs = list_notifications(&client)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(acct_id) = get_active_account_db_id(pool.inner()) {
        for n in &notifs {
            let _ = crate::cache::notifications::upsert_notification(pool.inner(), acct_id, n);
        }
    }
    let mut review_requests = Vec::new();
    let mut mentions = Vec::new();
    for n in &notifs {
        let item = notification_to_inbox_item(n);
        match n.reason.as_str() {
            "review_requested" => review_requests.push(item),
            "mention" => mentions.push(item),
            _ => {}
        }
    }
    let ci_failures = read_ci_failures(pool.inner()).unwrap_or_default();
    Ok(InboxData {
        review_requests,
        ci_failures,
        mentions,
    })
}

#[tauri::command]
pub async fn cmd_get_notifications<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<NotificationItem>, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let notifs = list_notifications(&client)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(acct_id) = get_active_account_db_id(pool.inner()) {
        for n in &notifs {
            let _ = crate::cache::notifications::upsert_notification(pool.inner(), acct_id, n);
        }
    }
    Ok(notifs.iter().map(notification_to_item).collect())
}

#[tauri::command]
pub async fn cmd_mark_notification_read<R: Runtime>(
    app: AppHandle<R>,
    thread_id: String,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    crate::cache::notifications::mark_notification_read(pool.inner(), &thread_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_mark_all_notifications_read<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id = get_active_account_db_id(pool.inner())
        .ok_or_else(|| "no active account".to_string())?;
    crate::cache::notifications::mark_all_notifications_read(pool.inner(), account_db_id)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{NotificationSubject, Repository, User};
    use std::path::Path;

    fn sample_repo() -> Repository {
        Repository {
            id: 1,
            name: "hello".into(),
            full_name: "octocat/hello".into(),
            private: false,
            owner: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: "".into(),
                html_url: "".into(),
                name: None,
            },
            html_url: "https://github.com/octocat/hello".into(),
            description: None,
            fork: false,
            default_branch: "main".into(),
        }
    }

    fn make_notification(reason: &str) -> Notification {
        Notification {
            id: "thread-1".to_string(),
            unread: true,
            reason: reason.to_string(),
            updated_at: "2026-04-21T00:00:00Z".to_string(),
            url: "https://api.github.com/notifications/threads/1".to_string(),
            subject: NotificationSubject {
                title: "Fix the thing".to_string(),
                url: Some("https://api.github.com/repos/octocat/hello/pulls/5".to_string()),
                latest_comment_url: None,
                subject_type: "PullRequest".to_string(),
            },
            repository: sample_repo(),
        }
    }

    #[test]
    fn notification_to_inbox_item_converts_api_url() {
        let n = make_notification("review_requested");
        let item = notification_to_inbox_item(&n);
        assert_eq!(item.id, "thread-1");
        assert_eq!(item.repo, "octocat/hello");
        assert_eq!(item.title, "Fix the thing");
        assert_eq!(
            item.html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/5")
        );
        assert!(item.unread);
    }

    #[test]
    fn api_url_to_html_converts_pulls_path() {
        let url = "https://api.github.com/repos/octocat/hello/pulls/7";
        assert_eq!(
            api_url_to_html(url),
            "https://github.com/octocat/hello/pull/7"
        );
    }

    #[test]
    fn api_url_to_html_preserves_issues_path() {
        let url = "https://api.github.com/repos/octocat/hello/issues/3";
        assert_eq!(
            api_url_to_html(url),
            "https://github.com/octocat/hello/issues/3"
        );
    }

    #[test]
    fn read_ci_failures_returns_empty_when_no_failing_ci() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let result = read_ci_failures(&pool).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn read_ci_failures_returns_pull_with_failing_ci() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at) VALUES (1,'octocat','github.com',1,'2026-04-21')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched) VALUES (1,1,'octocat/hello',1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, raw_json, ci_state, updated_at, fetched_at)
             VALUES (1, 10, 'Broken PR', 'open', 0, '{\"html_url\":\"https://github.com/octocat/hello/pull/10\"}', 'failure', '2026-04-21', '2026-04-21')",
            [],
        )
        .unwrap();
        drop(conn);
        let result = read_ci_failures(&pool).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].number, Some(10));
        assert_eq!(result[0].kind, "ci_failure");
        assert_eq!(
            result[0].html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/10")
        );
    }
}
