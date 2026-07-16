//! Local cache of GitHub releases for watched repositories.

use rusqlite::params;

use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::types::Release;

pub fn upsert_release(
    pool: &SqlitePool,
    repo_id: i64,
    release: &Release,
    fetched_at: &str,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    let raw_json = serde_json::to_string(release)?;
    conn.execute(
        "INSERT INTO releases
             (id, repo_id, tag_name, name, prerelease, published_at, html_url, raw_json, fetched_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
             tag_name     = excluded.tag_name,
             name         = excluded.name,
             prerelease   = excluded.prerelease,
             published_at = excluded.published_at,
             html_url     = excluded.html_url,
             raw_json     = excluded.raw_json,
             fetched_at   = excluded.fetched_at",
        params![
            release.id as i64,
            repo_id,
            release.tag_name,
            release.name,
            if release.prerelease { 1i32 } else { 0i32 },
            release.published_at,
            release.html_url,
            raw_json,
            fetched_at,
        ],
    )?;
    Ok(())
}

pub struct CachedRelease {
    pub id: i64,
    pub repo_full_name: String,
    pub tag_name: String,
    pub name: Option<String>,
    pub prerelease: bool,
    pub published_at: Option<String>,
    pub html_url: String,
}

/// Latest releases across an account's watched repositories, newest first.
pub fn list_recent_releases(
    pool: &SqlitePool,
    account_id: i64,
    limit: u32,
) -> Result<Vec<CachedRelease>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT rel.id, r.full_name, rel.tag_name, rel.name, rel.prerelease,
                rel.published_at, rel.html_url
         FROM releases rel
         JOIN repos r ON r.id = rel.repo_id
         WHERE r.account_id = ?1
         ORDER BY rel.published_at DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![account_id, limit], |row| {
        Ok(CachedRelease {
            id: row.get(0)?,
            repo_full_name: row.get(1)?,
            tag_name: row.get(2)?,
            name: row.get(3)?,
            prerelease: row.get::<_, i32>(4)? == 1,
            published_at: row.get(5)?,
            html_url: row.get(6)?,
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

    fn sample_release(id: u64, tag: &str, published_at: &str) -> Release {
        Release {
            id,
            tag_name: tag.to_string(),
            name: Some(format!("Release {tag}")),
            draft: false,
            prerelease: false,
            published_at: Some(published_at.to_string()),
            html_url: format!("https://github.com/octocat/hello/releases/tag/{tag}"),
        }
    }

    #[test]
    fn upsert_release_inserts_and_lists() {
        let pool = test_pool();
        upsert_release(
            &pool,
            10,
            &sample_release(1, "v1.0.0", "2026-07-01T00:00:00Z"),
            "2026-07-16T00:00:00Z",
        )
        .unwrap();
        let rows = list_recent_releases(&pool, 1, 50).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tag_name, "v1.0.0");
        assert_eq!(rows[0].repo_full_name, "octocat/hello");
    }

    #[test]
    fn upsert_release_is_idempotent_and_updates() {
        let pool = test_pool();
        let mut release = sample_release(1, "v1.0.0", "2026-07-01T00:00:00Z");
        upsert_release(&pool, 10, &release, "2026-07-16T00:00:00Z").unwrap();
        release.name = Some("Renamed".to_string());
        upsert_release(&pool, 10, &release, "2026-07-16T01:00:00Z").unwrap();
        let rows = list_recent_releases(&pool, 1, 50).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name.as_deref(), Some("Renamed"));
    }

    #[test]
    fn list_recent_releases_orders_newest_first() {
        let pool = test_pool();
        upsert_release(
            &pool,
            10,
            &sample_release(1, "v1.0.0", "2026-07-01T00:00:00Z"),
            "2026-07-16T00:00:00Z",
        )
        .unwrap();
        upsert_release(
            &pool,
            10,
            &sample_release(2, "v1.1.0", "2026-07-10T00:00:00Z"),
            "2026-07-16T00:00:00Z",
        )
        .unwrap();
        let rows = list_recent_releases(&pool, 1, 50).unwrap();
        assert_eq!(rows[0].tag_name, "v1.1.0");
        assert_eq!(rows[1].tag_name, "v1.0.0");
    }

    #[test]
    fn list_recent_releases_scoped_to_account() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (2, 'hubot', 'github.com', 0, '2026-07-16T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (20, 2, 'hubot/other', 1)",
            [],
        )
        .unwrap();
        drop(conn);
        upsert_release(
            &pool,
            20,
            &sample_release(5, "v9.0.0", "2026-07-15T00:00:00Z"),
            "2026-07-16T00:00:00Z",
        )
        .unwrap();
        let rows = list_recent_releases(&pool, 1, 50).unwrap();
        assert!(rows.is_empty());
    }
}
