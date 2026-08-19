use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::commands::limits::validate_inbox_first;
use crate::db::SqlitePool;
use crate::github::graphql::{fetch_inbox, inbox_query};
use crate::github::rest::{
    list_notifications, mark_all_notifications_read, mark_notification_thread_read,
};
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
    #[serde(default)]
    pub pinned: bool,
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

#[cfg(test)]
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
        pinned: false,
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

fn review_requests_from_graphql(data: &inbox_query::ResponseData) -> Vec<InboxItem> {
    data.review_requests
        .nodes
        .as_ref()
        .map(|nodes| {
            nodes
                .iter()
                .filter_map(|node| match node {
                    Some(inbox_query::InboxQueryReviewRequestsNodes::PullRequest(pr)) => {
                        Some(InboxItem {
                            id: pr.id.clone(),
                            kind: "review_requested".to_string(),
                            repo: pr.repository.name_with_owner.clone(),
                            number: Some(pr.number),
                            title: pr.title.clone(),
                            html_url: Some(pr.url.clone()),
                            updated_at: pr.updated_at.clone(),
                            unread: true,
                            pinned: false,
                        })
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn mentions_from_graphql(data: &inbox_query::ResponseData) -> Vec<InboxItem> {
    data.mentions
        .nodes
        .as_ref()
        .map(|nodes| {
            nodes
                .iter()
                .filter_map(|node| match node {
                    Some(inbox_query::InboxQueryMentionsNodes::Issue(issue)) => Some(InboxItem {
                        id: issue.id.clone(),
                        kind: "mention".to_string(),
                        repo: issue.repository.name_with_owner.clone(),
                        number: Some(issue.number),
                        title: issue.title.clone(),
                        html_url: Some(issue.url.clone()),
                        updated_at: issue.updated_at.clone(),
                        unread: true,
                        pinned: false,
                    }),
                    Some(inbox_query::InboxQueryMentionsNodes::PullRequest(pr)) => {
                        Some(InboxItem {
                            id: pr.id.clone(),
                            kind: "mention".to_string(),
                            repo: pr.repository.name_with_owner.clone(),
                            number: Some(pr.number),
                            title: pr.title.clone(),
                            html_url: Some(pr.url.clone()),
                            updated_at: pr.updated_at.clone(),
                            unread: true,
                            pinned: false,
                        })
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
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
            pinned: false,
        });
    }
    Ok(out)
}

/// Drops snoozed / dismissed items and floats pinned items to the top of their section,
/// preserving the underlying (updated_at desc) order otherwise.
fn apply_item_states(
    items: Vec<InboxItem>,
    states: &std::collections::HashMap<String, crate::cache::inbox_state::InboxItemState>,
    now: i64,
) -> Vec<InboxItem> {
    let mut out: Vec<InboxItem> = items
        .into_iter()
        .filter(|item| {
            let Some(state) = states.get(&item.id) else {
                return true;
            };
            if state.dismissed {
                return false;
            }
            state.snoozed_until.is_none_or(|until| until <= now)
        })
        .map(|mut item| {
            item.pinned = states.get(&item.id).map(|s| s.pinned).unwrap_or(false);
            item
        })
        .collect();
    out.sort_by_key(|item| !item.pinned);
    out
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountAttentionSummary {
    pub login: String,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub review_requests: usize,
    pub ci_failures: usize,
    pub mentions: usize,
}

impl AccountAttentionSummary {
    pub fn total(&self) -> usize {
        self.review_requests + self.ci_failures + self.mentions
    }
}

/// Cache-only attention counts per account (no GitHub API calls).
/// Review / mention ≈ unread notification reasons; CI ≈ failing pulls (minus dismissed/snoozed).
fn read_account_attention_summaries(
    pool: &SqlitePool,
) -> Result<Vec<AccountAttentionSummary>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let now = crate::cache::inbox_state::now_epoch_secs();
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.login, a.avatar_url, a.is_active,
                (SELECT COUNT(*) FROM notifications n
                 WHERE n.account_id = a.id AND n.is_read = 0
                   AND n.reason = 'review_requested') AS review_count,
                (SELECT COUNT(*) FROM notifications n
                 WHERE n.account_id = a.id AND n.is_read = 0
                   AND n.reason IN ('mention', 'team_mention')) AS mention_count,
                (SELECT COUNT(*) FROM pulls p
                 JOIN repos r ON r.id = p.repo_id
                 LEFT JOIN inbox_item_state s
                   ON s.account_id = a.id
                  AND s.item_id = 'ci-' || r.full_name || '-' || CAST(p.number AS TEXT)
                 WHERE r.account_id = a.id
                   AND p.ci_state = 'failure'
                   AND COALESCE(s.dismissed, 0) = 0
                   AND (s.snoozed_until IS NULL OR s.snoozed_until <= ?1)) AS ci_count
             FROM accounts a
             ORDER BY a.is_active DESC, a.login ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![now], |row| {
            Ok(AccountAttentionSummary {
                login: row.get(1)?,
                avatar_url: row.get(2)?,
                is_active: row.get::<_, i32>(3)? == 1,
                review_requests: row.get::<_, i64>(4)? as usize,
                mentions: row.get::<_, i64>(5)? as usize,
                ci_failures: row.get::<_, i64>(6)? as usize,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Returns per-account Inbox-aligned attention counts from local cache only.
#[tauri::command]
pub async fn cmd_get_account_attention_summaries<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<AccountAttentionSummary>, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    read_account_attention_summaries(pool.inner())
}

/// An Inbox item tagged with the account it belongs to, for the cross-account
/// "All accounts" view. Built from local cache only (no live API calls) so
/// non-active accounts can be shown without switching to them first.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrossAccountInboxItem {
    pub id: String,
    pub kind: String,
    pub repo: String,
    pub number: Option<i64>,
    pub title: String,
    pub html_url: Option<String>,
    pub updated_at: String,
    pub unread: bool,
    pub pinned: bool,
    pub account_login: String,
    pub account_avatar_url: Option<String>,
    pub is_active_account: bool,
}

/// Parses the trailing `/{number}` segment off a GitHub html/API URL, e.g.
/// `.../pull/42` or `.../issues/7` → `Some(42)` / `Some(7)`.
fn extract_number_from_url(url: &str) -> Option<i64> {
    url.rsplit('/').next()?.parse::<i64>().ok()
}

struct CachedAccount {
    id: i64,
    login: String,
    avatar_url: Option<String>,
    is_active: bool,
}

fn list_accounts(pool: &SqlitePool) -> Result<Vec<CachedAccount>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, login, avatar_url, is_active FROM accounts ORDER BY is_active DESC, login ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CachedAccount {
                id: row.get(0)?,
                login: row.get(1)?,
                avatar_url: row.get(2)?,
                is_active: row.get::<_, i32>(3)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// review_requested / mention notifications cached for one account, converted
/// to Inbox-shaped rows. Notifications don't carry a PR/issue number directly,
/// so it's recovered from the cached subject API URL.
fn read_notification_inbox_items_for_account(
    pool: &SqlitePool,
    account_id: i64,
) -> Result<Vec<InboxItem>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT thread_id, subject_title, reason, is_read, updated_at,
                    repo_full_name, subject_url
             FROM notifications
             WHERE account_id = ?1
               AND is_read = 0
               AND reason IN ('review_requested', 'mention', 'team_mention')
             ORDER BY updated_at DESC
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![account_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let (thread_id, title, reason, is_read, updated_at, repo, subject_url) =
            r.map_err(|e| e.to_string())?;
        let kind = match reason.as_deref() {
            Some("review_requested") => "review_requested",
            _ => "mention",
        };
        let html_url = subject_url.as_deref().map(api_url_to_html);
        let number = html_url.as_deref().and_then(extract_number_from_url);
        out.push(InboxItem {
            id: thread_id,
            kind: kind.to_string(),
            repo: repo.unwrap_or_default(),
            number,
            title: title.unwrap_or_default(),
            html_url,
            updated_at,
            unread: is_read == 0,
            pinned: false,
        });
    }
    Ok(out)
}

/// Failing-CI pulls cached for one account's repos.
fn read_ci_failures_for_account(
    pool: &SqlitePool,
    account_id: i64,
) -> Result<Vec<InboxItem>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.number, p.title, p.raw_json, r.full_name, p.updated_at
             FROM pulls p
             JOIN repos r ON r.id = p.repo_id
             WHERE p.ci_state = 'failure' AND r.account_id = ?1
             ORDER BY p.updated_at DESC
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![account_id], |row| {
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
            pinned: false,
        });
    }
    Ok(out)
}

/// Cache-only Inbox items across every cached account, each tagged with its
/// owning account, for the "All accounts" cross-account Inbox view. Snoozed /
/// dismissed items are filtered per-account, pinned items are marked but not
/// reordered (the frontend groups/sorts across accounts).
fn read_cross_account_inbox(pool: &SqlitePool) -> Result<Vec<CrossAccountInboxItem>, String> {
    let now = crate::cache::inbox_state::now_epoch_secs();
    let accounts = list_accounts(pool)?;
    let mut out = Vec::new();
    for account in &accounts {
        let mut items = read_notification_inbox_items_for_account(pool, account.id)?;
        items.extend(read_ci_failures_for_account(pool, account.id)?);
        let states = crate::cache::inbox_state::get_states(pool, account.id).unwrap_or_default();
        for item in apply_item_states(items, &states, now) {
            out.push(CrossAccountInboxItem {
                id: item.id,
                kind: item.kind,
                repo: item.repo,
                number: item.number,
                title: item.title,
                html_url: item.html_url,
                updated_at: item.updated_at,
                unread: item.unread,
                pinned: item.pinned,
                account_login: account.login.clone(),
                account_avatar_url: account.avatar_url.clone(),
                is_active_account: account.is_active,
            });
        }
    }
    out.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then(b.updated_at.cmp(&a.updated_at))
    });
    Ok(out)
}

/// Returns Inbox items for every cached account (local cache only), each
/// tagged with its account, powering the Inbox "All accounts" toggle without
/// switching the active account.
#[tauri::command]
pub async fn cmd_get_cross_account_inbox<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<CrossAccountInboxItem>, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    read_cross_account_inbox(pool.inner())
}

#[tauri::command]
pub async fn cmd_get_inbox<R: Runtime>(
    app: AppHandle<R>,
    first: Option<i64>,
) -> Result<InboxData, String> {
    let first = validate_inbox_first(first)?;
    let client = crate::github::client::client_for_active_account()?;
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let inbox = fetch_inbox(&client, first)
        .await
        .map_err(|e| e.to_string())?;
    let review_requests = review_requests_from_graphql(&inbox);
    let mentions = mentions_from_graphql(&inbox);
    let ci_failures = read_ci_failures(pool.inner()).unwrap_or_default();
    let now = crate::cache::inbox_state::now_epoch_secs();
    let states = get_active_account_db_id(pool.inner())
        .and_then(|acct_id| {
            let _ = crate::cache::inbox_state::purge_expired(pool.inner(), acct_id, now);
            crate::cache::inbox_state::get_states(pool.inner(), acct_id).ok()
        })
        .unwrap_or_default();
    Ok(InboxData {
        review_requests: apply_item_states(review_requests, &states, now),
        ci_failures: apply_item_states(ci_failures, &states, now),
        mentions: apply_item_states(mentions, &states, now),
    })
}

#[tauri::command]
pub async fn cmd_pin_inbox_item<R: Runtime>(
    app: AppHandle<R>,
    item_id: String,
    pinned: bool,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
    crate::cache::inbox_state::set_pinned(pool.inner(), account_db_id, &item_id, pinned)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_snooze_inbox_item<R: Runtime>(
    app: AppHandle<R>,
    item_id: String,
    snoozed_until: Option<i64>,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
    crate::cache::inbox_state::set_snoozed_until(
        pool.inner(),
        account_db_id,
        &item_id,
        snoozed_until,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_dismiss_inbox_item<R: Runtime>(
    app: AppHandle<R>,
    item_id: String,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
    crate::cache::inbox_state::set_dismissed(pool.inner(), account_db_id, &item_id, true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_dismiss_inbox_items<R: Runtime>(
    app: AppHandle<R>,
    item_ids: Vec<String>,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
    crate::cache::inbox_state::set_dismissed_many(pool.inner(), account_db_id, &item_ids, true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_notifications<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<NotificationItem>, String> {
    let client = crate::github::client::client_for_active_account()?;
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
    let client = crate::github::client::client_for_active_account()?;
    mark_notification_thread_read(&client, &thread_id)
        .await
        .map_err(|e| e.to_string())?;

    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    crate::cache::notifications::mark_notification_read(pool.inner(), &thread_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_mark_all_notifications_read<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let client = crate::github::client::client_for_active_account()?;
    mark_all_notifications_read(&client)
        .await
        .map_err(|e| e.to_string())?;

    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;
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
    fn graphql_review_request_node_maps_to_inbox_item() {
        let data = serde_json::json!({
            "reviewRequests": {
                "issueCount": 1,
                "nodes": [{
                    "__typename": "PullRequest",
                    "id": "PR_kw1",
                    "number": 42,
                    "title": "Review this",
                    "url": "https://github.com/octocat/hello/pull/42",
                    "createdAt": "2026-04-21T00:00:00Z",
                    "updatedAt": "2026-04-22T00:00:00Z",
                    "isDraft": false,
                    "state": "OPEN",
                    "repository": { "nameWithOwner": "octocat/hello" },
                    "author": {
                        "__typename": "User",
                        "login": "alice",
                        "avatarUrl": "https://example.test/a.png"
                    }
                }]
            },
            "mentions": { "issueCount": 0, "nodes": [] },
            "assignedIssues": { "issueCount": 0, "nodes": [] },
            "rateLimit": null
        });
        let parsed: crate::github::graphql::inbox_query::ResponseData =
            serde_json::from_value(data).unwrap();

        let items = review_requests_from_graphql(&parsed);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "PR_kw1");
        assert_eq!(items[0].kind, "review_requested");
        assert_eq!(items[0].repo, "octocat/hello");
        assert_eq!(items[0].number, Some(42));
        assert_eq!(items[0].title, "Review this");
        assert_eq!(
            items[0].html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/42")
        );
        assert_eq!(items[0].updated_at, "2026-04-22T00:00:00Z");
        assert!(items[0].unread);
    }

    #[test]
    fn graphql_mentions_map_issue_and_pull_request_nodes() {
        let data = serde_json::json!({
            "reviewRequests": { "issueCount": 0, "nodes": [] },
            "mentions": {
                "issueCount": 2,
                "nodes": [
                    {
                        "__typename": "Issue",
                        "id": "I_kw1",
                        "number": 7,
                        "title": "Mentioned issue",
                        "url": "https://github.com/octocat/hello/issues/7",
                        "createdAt": "2026-04-20T00:00:00Z",
                        "updatedAt": "2026-04-21T00:00:00Z",
                        "repository": { "nameWithOwner": "octocat/hello" },
                        "author": {
                            "__typename": "User",
                            "login": "bob",
                            "avatarUrl": "https://example.test/b.png"
                        }
                    },
                    {
                        "__typename": "PullRequest",
                        "id": "PR_kw2",
                        "number": 8,
                        "title": "Mentioned PR",
                        "url": "https://github.com/octocat/hello/pull/8",
                        "createdAt": "2026-04-20T00:00:00Z",
                        "updatedAt": "2026-04-22T00:00:00Z",
                        "isDraft": false,
                        "state": "OPEN",
                        "repository": { "nameWithOwner": "octocat/hello" },
                        "author": {
                            "__typename": "User",
                            "login": "carol",
                            "avatarUrl": "https://example.test/c.png"
                        }
                    }
                ]
            },
            "assignedIssues": { "issueCount": 0, "nodes": [] },
            "rateLimit": null
        });
        let parsed: crate::github::graphql::inbox_query::ResponseData =
            serde_json::from_value(data).unwrap();

        let items = mentions_from_graphql(&parsed);

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "I_kw1");
        assert_eq!(items[0].kind, "mention");
        assert_eq!(items[0].number, Some(7));
        assert_eq!(
            items[0].html_url.as_deref(),
            Some("https://github.com/octocat/hello/issues/7")
        );
        assert_eq!(items[1].id, "PR_kw2");
        assert_eq!(items[1].kind, "mention");
        assert_eq!(items[1].number, Some(8));
        assert_eq!(
            items[1].html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/8")
        );
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

    fn make_item(id: &str) -> InboxItem {
        InboxItem {
            id: id.to_string(),
            kind: "review_requested".to_string(),
            repo: "octocat/hello".to_string(),
            number: Some(1),
            title: format!("Item {id}"),
            html_url: None,
            updated_at: "2026-07-16T00:00:00Z".to_string(),
            unread: true,
            pinned: false,
        }
    }

    #[test]
    fn apply_item_states_drops_actively_snoozed_items() {
        use crate::cache::inbox_state::InboxItemState;
        let mut states = std::collections::HashMap::new();
        states.insert(
            "snoozed".to_string(),
            InboxItemState {
                pinned: false,
                snoozed_until: Some(2_000),
                dismissed: false,
            },
        );
        states.insert(
            "expired".to_string(),
            InboxItemState {
                pinned: false,
                snoozed_until: Some(500),
                dismissed: false,
            },
        );
        let items = vec![
            make_item("snoozed"),
            make_item("expired"),
            make_item("plain"),
        ];
        let out = apply_item_states(items, &states, 1_000);
        let ids: Vec<&str> = out.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["expired", "plain"]);
    }

    #[test]
    fn apply_item_states_drops_dismissed_items() {
        use crate::cache::inbox_state::InboxItemState;
        let mut states = std::collections::HashMap::new();
        states.insert(
            "done".to_string(),
            InboxItemState {
                pinned: false,
                snoozed_until: None,
                dismissed: true,
            },
        );
        let items = vec![make_item("done"), make_item("plain")];
        let out = apply_item_states(items, &states, 1_000);
        let ids: Vec<&str> = out.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["plain"]);
    }

    #[test]
    fn apply_item_states_floats_pinned_to_top_keeping_order() {
        use crate::cache::inbox_state::InboxItemState;
        let mut states = std::collections::HashMap::new();
        states.insert(
            "b".to_string(),
            InboxItemState {
                pinned: true,
                snoozed_until: None,
                dismissed: false,
            },
        );
        let items = vec![make_item("a"), make_item("b"), make_item("c")];
        let out = apply_item_states(items, &states, 1_000);
        let ids: Vec<&str> = out.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["b", "a", "c"]);
        assert!(out[0].pinned);
        assert!(!out[1].pinned);
    }

    #[test]
    fn read_account_attention_summaries_counts_review_ci_mention_per_account() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, avatar_url, is_active, created_at)
             VALUES (1,'alice','github.com',NULL,1,'2026-04-21'),
                    (2,'bob','github.com',NULL,0,'2026-04-21')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name) VALUES (10, 1, 'a/r'), (20, 2, 'b/r')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, raw_json, ci_state, updated_at, fetched_at)
             VALUES (10, 1, 'fail-a', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21'),
                    (20, 2, 'fail-b', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21'),
                    (20, 3, 'ok-b', 'open', 0, '{}', 'success', '2026-04-21', '2026-04-21')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, reason, is_read, updated_at, repo_full_name)
             VALUES (1, 't1', 'review_requested', 0, '2026-04-21', 'a/r'),
                    (1, 't2', 'mention', 0, '2026-04-21', 'a/r'),
                    (1, 't3', 'mention', 1, '2026-04-21', 'a/r'),
                    (2, 't4', 'team_mention', 0, '2026-04-21', 'b/r'),
                    (2, 't5', 'assign', 0, '2026-04-21', 'b/r')",
            [],
        )
        .unwrap();
        drop(conn);

        let summaries = read_account_attention_summaries(&pool).unwrap();
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].login, "alice");
        assert!(summaries[0].is_active);
        assert_eq!(summaries[0].review_requests, 1);
        assert_eq!(summaries[0].mentions, 1);
        assert_eq!(summaries[0].ci_failures, 1);
        assert_eq!(summaries[0].total(), 3);

        assert_eq!(summaries[1].login, "bob");
        assert!(!summaries[1].is_active);
        assert_eq!(summaries[1].review_requests, 0);
        assert_eq!(summaries[1].mentions, 1);
        assert_eq!(summaries[1].ci_failures, 1);
        assert_eq!(summaries[1].total(), 2);
    }

    #[test]
    fn read_account_attention_summaries_skips_dismissed_ci() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1,'alice','github.com',1,'2026-04-21')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name) VALUES (10, 1, 'a/r')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, raw_json, ci_state, updated_at, fetched_at)
             VALUES (10, 1, 'fail', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21')",
            [],
        )
        .unwrap();
        drop(conn);
        crate::cache::inbox_state::set_dismissed(&pool, 1, "ci-a/r-1", true).unwrap();

        let summaries = read_account_attention_summaries(&pool).unwrap();
        assert_eq!(summaries[0].ci_failures, 0);
    }

    #[test]
    fn extract_number_from_url_parses_trailing_segment() {
        assert_eq!(
            extract_number_from_url("https://github.com/octocat/hello/pull/42"),
            Some(42)
        );
        assert_eq!(
            extract_number_from_url("https://github.com/octocat/hello/issues/7"),
            Some(7)
        );
        assert_eq!(extract_number_from_url("not-a-number"), None);
    }

    fn seed_two_accounts(pool: &SqlitePool) {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, avatar_url, is_active, created_at)
             VALUES (1,'alice','github.com','https://a.test/a.png',1,'2026-04-21'),
                    (2,'bob','github.com','https://a.test/b.png',0,'2026-04-21')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name) VALUES (10, 1, 'a/r'), (20, 2, 'b/r')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn read_notification_inbox_items_for_account_derives_number_from_subject_url() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        seed_two_accounts(&pool);
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, subject_title, reason, is_read, updated_at, repo_full_name, subject_url)
             VALUES (2, 't1', 'Review this', 'review_requested', 0, '2026-04-21', 'b/r',
                     'https://api.github.com/repos/b/r/pulls/9'),
                    (2, 't2', 'Read notification', 'mention', 1, '2026-04-21', 'b/r',
                     'https://api.github.com/repos/b/r/issues/3')",
            [],
        )
        .unwrap();
        drop(conn);

        let items = read_notification_inbox_items_for_account(&pool, 2).unwrap();
        assert_eq!(items.len(), 1, "only unread notifications are returned");
        assert_eq!(items[0].id, "t1");
        assert_eq!(items[0].kind, "review_requested");
        assert_eq!(items[0].number, Some(9));
        assert_eq!(
            items[0].html_url.as_deref(),
            Some("https://github.com/b/r/pull/9")
        );
    }

    #[test]
    fn read_ci_failures_for_account_scopes_to_account_repos() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        seed_two_accounts(&pool);
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, raw_json, ci_state, updated_at, fetched_at)
             VALUES (10, 1, 'fail-a', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21'),
                    (20, 2, 'fail-b', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21')",
            [],
        )
        .unwrap();
        drop(conn);

        let alice_failures = read_ci_failures_for_account(&pool, 1).unwrap();
        assert_eq!(alice_failures.len(), 1);
        assert_eq!(alice_failures[0].repo, "a/r");

        let bob_failures = read_ci_failures_for_account(&pool, 2).unwrap();
        assert_eq!(bob_failures.len(), 1);
        assert_eq!(bob_failures[0].repo, "b/r");
    }

    #[test]
    fn read_cross_account_inbox_tags_items_with_account_and_skips_dismissed() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        seed_two_accounts(&pool);
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO pulls (repo_id, number, title, state, is_draft, raw_json, ci_state, updated_at, fetched_at)
             VALUES (10, 1, 'fail-a', 'open', 0, '{}', 'failure', '2026-04-21', '2026-04-21'),
                    (20, 2, 'fail-b', 'open', 0, '{}', 'failure', '2026-04-22', '2026-04-22')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, subject_title, reason, is_read, updated_at, repo_full_name, subject_url)
             VALUES (2, 't1', 'Review this', 'review_requested', 0, '2026-04-23', 'b/r',
                     'https://api.github.com/repos/b/r/pulls/9')",
            [],
        )
        .unwrap();
        drop(conn);
        crate::cache::inbox_state::set_dismissed(&pool, 1, "ci-a/r-1", true).unwrap();

        let items = read_cross_account_inbox(&pool).unwrap();
        let ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();
        assert!(
            !ids.contains(&"ci-a/r-1"),
            "dismissed items are filtered out"
        );
        assert!(ids.contains(&"ci-b/r-2"));
        assert!(ids.contains(&"t1"));

        let bob_item = items.iter().find(|i| i.id == "t1").unwrap();
        assert_eq!(bob_item.account_login, "bob");
        assert_eq!(
            bob_item.account_avatar_url.as_deref(),
            Some("https://a.test/b.png")
        );
        assert!(!bob_item.is_active_account);

        // Most recently updated first.
        assert_eq!(items[0].id, "t1");
    }
}
