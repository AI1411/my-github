//! Helpers around the `sync_meta` table for tracking the last-fetched
//! timestamp and ETag per-resource, per-repository.
//!
//! Keys in the `sync_meta` table are namespaced as
//! `{scope}:{repo_full_name}:{kind}` where `scope` is one of `pulls`,
//! `issues`, `notifications` and `kind` is `last_fetched_at` or `etag`.

use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};

use crate::cache::CacheError;
use crate::db::SqlitePool;

/// The resource a sync-meta row tracks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Pulls,
    Issues,
    Notifications,
}

impl Scope {
    fn as_str(self) -> &'static str {
        match self {
            Scope::Pulls => "pulls",
            Scope::Issues => "issues",
            Scope::Notifications => "notifications",
        }
    }
}

fn key(scope: Scope, repo_full_name: &str, kind: &str) -> String {
    format!("{}:{}:{}", scope.as_str(), repo_full_name, kind)
}

pub fn set_last_fetched_at(
    pool: &SqlitePool,
    scope: Scope,
    repo_full_name: &str,
    ts: &str,
) -> Result<(), CacheError> {
    upsert_meta(pool, &key(scope, repo_full_name, "last_fetched_at"), ts)
}

pub fn get_last_fetched_at(
    pool: &SqlitePool,
    scope: Scope,
    repo_full_name: &str,
) -> Result<Option<String>, CacheError> {
    get_meta(pool, &key(scope, repo_full_name, "last_fetched_at"))
}

pub fn set_etag(
    pool: &SqlitePool,
    scope: Scope,
    repo_full_name: &str,
    etag: &str,
) -> Result<(), CacheError> {
    upsert_meta(pool, &key(scope, repo_full_name, "etag"), etag)
}

pub fn get_etag(
    pool: &SqlitePool,
    scope: Scope,
    repo_full_name: &str,
) -> Result<Option<String>, CacheError> {
    get_meta(pool, &key(scope, repo_full_name, "etag"))
}

fn upsert_meta(pool: &SqlitePool, key: &str, value: &str) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO sync_meta (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
        params![key, value, now_epoch_secs()],
    )?;
    Ok(())
}

fn get_meta(pool: &SqlitePool, key: &str) -> Result<Option<String>, CacheError> {
    let conn = pool.get()?;
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value)
}

fn now_epoch_secs() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use std::path::Path;

    fn pool_with_schema() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    #[test]
    fn get_returns_none_when_missing() {
        let pool = pool_with_schema();
        assert_eq!(
            get_last_fetched_at(&pool, Scope::Pulls, "octocat/hello").unwrap(),
            None
        );
        assert_eq!(
            get_etag(&pool, Scope::Issues, "octocat/hello").unwrap(),
            None
        );
    }

    #[test]
    fn set_and_get_last_fetched_at_roundtrip() {
        let pool = pool_with_schema();
        set_last_fetched_at(&pool, Scope::Pulls, "octocat/hello", "2026-04-21T00:00:00Z").unwrap();
        assert_eq!(
            get_last_fetched_at(&pool, Scope::Pulls, "octocat/hello").unwrap(),
            Some("2026-04-21T00:00:00Z".into())
        );
    }

    #[test]
    fn set_overwrites_existing_value() {
        let pool = pool_with_schema();
        set_etag(&pool, Scope::Issues, "octocat/hello", "W/\"abc\"").unwrap();
        set_etag(&pool, Scope::Issues, "octocat/hello", "W/\"def\"").unwrap();
        assert_eq!(
            get_etag(&pool, Scope::Issues, "octocat/hello").unwrap(),
            Some("W/\"def\"".into())
        );
    }

    #[test]
    fn keys_are_scoped_by_scope_and_repo() {
        let pool = pool_with_schema();
        set_etag(&pool, Scope::Pulls, "a/b", "P").unwrap();
        set_etag(&pool, Scope::Issues, "a/b", "I").unwrap();
        set_etag(&pool, Scope::Pulls, "c/d", "Q").unwrap();
        assert_eq!(
            get_etag(&pool, Scope::Pulls, "a/b").unwrap(),
            Some("P".into())
        );
        assert_eq!(
            get_etag(&pool, Scope::Issues, "a/b").unwrap(),
            Some("I".into())
        );
        assert_eq!(
            get_etag(&pool, Scope::Pulls, "c/d").unwrap(),
            Some("Q".into())
        );
    }

    #[test]
    fn last_fetched_at_and_etag_are_independent_kinds() {
        let pool = pool_with_schema();
        set_last_fetched_at(&pool, Scope::Notifications, "a/b", "2026-04-21T00:00:00Z").unwrap();
        set_etag(&pool, Scope::Notifications, "a/b", "W/\"n\"").unwrap();
        assert_eq!(
            get_last_fetched_at(&pool, Scope::Notifications, "a/b").unwrap(),
            Some("2026-04-21T00:00:00Z".into())
        );
        assert_eq!(
            get_etag(&pool, Scope::Notifications, "a/b").unwrap(),
            Some("W/\"n\"".into())
        );
    }
}
