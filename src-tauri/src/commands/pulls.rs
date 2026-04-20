use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::cache::pulls::upsert_pull;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::{get_pull_request_files, list_pull_requests};
use crate::github::types::{PullRequest, PullRequestFile};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PullFilter {
    /// "created" | "assigned" | "review" | "mentioned" | "all"
    pub tab: Option<String>,
    /// "open" | "closed" | null
    pub state: Option<String>,
    pub repo_full_name: Option<String>,
    pub author_login: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullSummary {
    pub id: i64,
    pub number: i64,
    pub title: String,
    pub repo: String,
    pub author: Option<String>,
    pub state: String,
    pub is_draft: bool,
    pub head_ref: String,
    pub base_ref: String,
    pub updated_at: String,
    pub html_url: Option<String>,
    pub ci_state: Option<String>,
    pub review_state: Option<String>,
    pub has_mention: bool,
    pub requested_reviewers: Vec<ReviewerInfo>,
    pub merged_at: Option<String>,
    pub additions: Option<i64>,
    pub deletions: Option<i64>,
    pub changed_files: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewerInfo {
    pub login: String,
    pub avatar_url: String,
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("@{}", secs)
}

fn read_cached_pulls(
    pool: &SqlitePool,
    filter: &PullFilter,
) -> Result<Vec<PullSummary>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT p.number, p.title, p.state, p.is_draft, p.author_login,
                p.head_ref, p.base_ref, p.ci_state, p.review_state, p.has_mention,
                p.raw_json, p.updated_at, r.full_name
         FROM pulls p
         JOIN repos r ON r.id = p.repo_id
         WHERE 1=1",
    );
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(state) = &filter.state {
        sql.push_str(" AND p.state = ?");
        args.push(Box::new(state.clone()));
    }
    if let Some(repo) = &filter.repo_full_name {
        sql.push_str(" AND r.full_name = ?");
        args.push(Box::new(repo.clone()));
    }
    if let Some(author) = &filter.author_login {
        sql.push_str(" AND p.author_login = ?");
        args.push(Box::new(author.clone()));
    }
    sql.push_str(" ORDER BY p.updated_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params = rusqlite::params_from_iter(args.iter().map(|b| b.as_ref()));
    let rows = stmt
        .query_map(params, |row| {
            let raw: String = row.get(10)?;
            Ok(CachedRow {
                number: row.get(0)?,
                title: row.get(1)?,
                state: row.get(2)?,
                is_draft: row.get::<_, i64>(3)? != 0,
                author_login: row.get(4)?,
                head_ref: row.get(5)?,
                base_ref: row.get(6)?,
                ci_state: row.get(7)?,
                review_state: row.get(8)?,
                has_mention: row.get::<_, i64>(9)? != 0,
                raw_json: raw,
                updated_at: row.get(11)?,
                repo_full_name: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let r = r.map_err(|e| e.to_string())?;
        out.push(row_to_summary(r));
    }
    Ok(out)
}

struct CachedRow {
    number: i64,
    title: String,
    state: String,
    is_draft: bool,
    author_login: Option<String>,
    head_ref: String,
    base_ref: String,
    ci_state: Option<String>,
    review_state: Option<String>,
    has_mention: bool,
    raw_json: String,
    updated_at: String,
    repo_full_name: String,
}

fn row_to_summary(r: CachedRow) -> PullSummary {
    let parsed: Option<PullRequest> = serde_json::from_str(&r.raw_json).ok();
    let (html_url, merged_at, reviewers) = match parsed.as_ref() {
        Some(pr) => (
            Some(pr.html_url.clone()),
            pr.merged_at.clone(),
            pr.requested_reviewers
                .iter()
                .map(|u| ReviewerInfo {
                    login: u.login.clone(),
                    avatar_url: u.avatar_url.clone(),
                })
                .collect(),
        ),
        None => (None, None, Vec::new()),
    };
    PullSummary {
        id: r.number,
        number: r.number,
        title: r.title,
        repo: r.repo_full_name,
        author: r.author_login,
        state: r.state,
        is_draft: r.is_draft,
        head_ref: r.head_ref,
        base_ref: r.base_ref,
        updated_at: r.updated_at,
        html_url,
        ci_state: r.ci_state,
        review_state: r.review_state,
        has_mention: r.has_mention,
        requested_reviewers: reviewers,
        merged_at,
        additions: None,
        deletions: None,
        changed_files: None,
    }
}

/// List cached pulls immediately, then spawn a background task to refresh
/// from GitHub. Emits `pulls-updated` when fresh data is written to cache.
#[tauri::command]
pub async fn cmd_list_pulls<R: Runtime>(
    app: AppHandle<R>,
    filter: PullFilter,
) -> Result<Vec<PullSummary>, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let cached = read_cached_pulls(pool.inner(), &filter)?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = refresh_pulls(&handle).await {
            let _ = handle.emit("pulls-refresh-error", e.to_string());
        } else {
            let _ = handle.emit("pulls-updated", ());
        }
    });

    Ok(cached)
}

async fn refresh_pulls<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    let client = GithubClient::new(token);

    let watched = {
        let conn = pool.get().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, full_name FROM repos
                 WHERE is_watched = 1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(WatchedRepo {
                    id: row.get(0)?,
                    full_name: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        out
    };

    for repo in watched {
        let (owner, name) = match repo.full_name.split_once('/') {
            Some(t) => t,
            None => continue,
        };
        match list_pull_requests(&client, owner, name, "open").await {
            Ok(prs) => {
                let now = now_iso();
                for pr in prs {
                    let _ = upsert_pull(pool.inner(), repo.id, &pr, &now);
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

struct WatchedRepo {
    id: i64,
    full_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub sha: String,
    pub filename: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: Option<String>,
    pub blob_url: String,
    pub raw_url: String,
}

impl From<PullRequestFile> for FileDiff {
    fn from(f: PullRequestFile) -> Self {
        FileDiff {
            sha: f.sha,
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
            patch: f.patch,
            blob_url: f.blob_url,
            raw_url: f.raw_url,
        }
    }
}

#[tauri::command]
pub async fn cmd_get_pull_files(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<FileDiff>, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    let client = GithubClient::new(token);
    let files = get_pull_request_files(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(files.into_iter().map(FileDiff::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::pulls::upsert_pull;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{PrRef, PullRequest, User};
    use std::path::Path;

    fn sample_pr(number: u32, title: &str, state: &str, draft: bool) -> PullRequest {
        PullRequest {
            id: number as u64,
            number,
            title: title.into(),
            state: state.into(),
            draft,
            html_url: format!("https://github.com/o/r/pull/{number}"),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: "https://a".into(),
                html_url: "https://u".into(),
                name: None,
            },
            body: None,
            created_at: "2026-04-20T00:00:00Z".into(),
            updated_at: "2026-04-21T00:00:00Z".into(),
            merged_at: None,
            head: PrRef {
                label: "o:feat".into(),
                ref_name: "feat".into(),
                sha: "abc".into(),
                repo: None,
            },
            base: PrRef {
                label: "o:main".into(),
                ref_name: "main".into(),
                sha: "def".into(),
                repo: None,
            },
            requested_reviewers: vec![],
        }
    }

    fn seed_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-04-21T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (1, 1, 'octocat/alpha', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (2, 1, 'octocat/beta', 1)",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    #[test]
    fn read_cached_pulls_returns_all_without_filter() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 2, &sample_pr(2, "b", "open", true), "now").unwrap();

        let got = read_cached_pulls(&pool, &PullFilter::default()).unwrap();
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn read_cached_pulls_filters_by_state() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 1, &sample_pr(2, "b", "closed", false), "now").unwrap();

        let filter = PullFilter {
            state: Some("open".into()),
            ..Default::default()
        };
        let got = read_cached_pulls(&pool, &filter).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].state, "open");
    }

    #[test]
    fn read_cached_pulls_filters_by_repo() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 2, &sample_pr(2, "b", "open", false), "now").unwrap();

        let filter = PullFilter {
            repo_full_name: Some("octocat/alpha".into()),
            ..Default::default()
        };
        let got = read_cached_pulls(&pool, &filter).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].repo, "octocat/alpha");
    }

    #[test]
    fn read_cached_pulls_populates_html_url_from_raw_json() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(7, "seven", "open", false), "now").unwrap();
        let got = read_cached_pulls(&pool, &PullFilter::default()).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(
            got[0].html_url.as_deref(),
            Some("https://github.com/o/r/pull/7")
        );
    }

    #[test]
    fn file_diff_conversion_preserves_fields() {
        let f = PullRequestFile {
            sha: "a".into(),
            filename: "src/lib.rs".into(),
            status: "modified".into(),
            additions: 3,
            deletions: 1,
            changes: 4,
            blob_url: "https://b".into(),
            raw_url: "https://r".into(),
            patch: Some("@@".into()),
        };
        let d: FileDiff = f.into();
        assert_eq!(d.filename, "src/lib.rs");
        assert_eq!(d.additions, 3);
        assert_eq!(d.patch, Some("@@".to_string()));
    }

    #[test]
    fn pull_filter_default_has_empty_labels() {
        let f = PullFilter::default();
        assert!(f.labels.is_empty());
        assert!(f.state.is_none());
    }
}
