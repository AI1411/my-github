use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::cache::releases::{list_recent_releases, upsert_release, CachedRelease};
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::list_releases;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseSummary {
    pub id: i64,
    pub repo: String,
    pub tag_name: String,
    pub name: Option<String>,
    pub prerelease: bool,
    pub published_at: Option<String>,
    pub html_url: String,
}

impl From<CachedRelease> for ReleaseSummary {
    fn from(r: CachedRelease) -> Self {
        ReleaseSummary {
            id: r.id,
            repo: r.repo_full_name,
            tag_name: r.tag_name,
            name: r.name,
            prerelease: r.prerelease,
            published_at: r.published_at,
            html_url: r.html_url,
        }
    }
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

fn watched_repos(pool: &SqlitePool, account_id: i64) -> Vec<(i64, String)> {
    let Ok(conn) = pool.get() else {
        return Vec::new();
    };
    let Ok(mut stmt) =
        conn.prepare("SELECT id, full_name FROM repos WHERE account_id = ?1 AND is_watched = 1")
    else {
        return Vec::new();
    };
    stmt.query_map([account_id], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })
    .map(|rows| rows.filter_map(Result::ok).collect())
    .unwrap_or_default()
}

fn now_iso8601() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 秒精度のUNIX時刻文字列で十分（表示にはpublished_atを使う）
    secs.to_string()
}

/// Fetch the latest releases for all watched repositories, cache them, and
/// return the most recent 50 across repositories. Per-repo fetch failures are
/// ignored so one broken repo does not hide the others.
#[tauri::command]
pub async fn cmd_list_releases<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<ReleaseSummary>, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    let account_db_id =
        get_active_account_db_id(pool.inner()).ok_or_else(|| "no active account".to_string())?;

    if let Some(token) = load_last_account_id().and_then(|id| load_token(&id)) {
        let client = GithubClient::new(token);
        let fetched_at = now_iso8601();
        for (repo_id, full_name) in watched_repos(pool.inner(), account_db_id) {
            let Some((owner, name)) = full_name.split_once('/') else {
                continue;
            };
            if let Ok(releases) = list_releases(&client, owner, name).await {
                for release in &releases {
                    let _ = upsert_release(pool.inner(), repo_id, release, &fetched_at);
                }
            }
        }
    }

    let rows = list_recent_releases(pool.inner(), account_db_id, 50).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(ReleaseSummary::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::Release;
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
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (11, 1, 'octocat/ignored', 0)",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    #[test]
    fn watched_repos_returns_only_watched() {
        let pool = test_pool();
        let repos = watched_repos(&pool, 1);
        assert_eq!(repos, vec![(10, "octocat/hello".to_string())]);
    }

    #[test]
    fn release_summary_from_cached_release() {
        let pool = test_pool();
        let release = Release {
            id: 1,
            tag_name: "v1.0.0".into(),
            name: Some("First".into()),
            draft: false,
            prerelease: true,
            published_at: Some("2026-07-01T00:00:00Z".into()),
            html_url: "https://github.com/octocat/hello/releases/tag/v1.0.0".into(),
        };
        upsert_release(&pool, 10, &release, "0").unwrap();
        let rows = list_recent_releases(&pool, 1, 50).unwrap();
        let summary = ReleaseSummary::from(rows.into_iter().next().unwrap());
        assert_eq!(summary.repo, "octocat/hello");
        assert_eq!(summary.tag_name, "v1.0.0");
        assert!(summary.prerelease);
    }
}
