# Sync Engine Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move repository, pull request, and issue synchronization into a backend Sync Engine with structured reports and persisted status.

**Architecture:** Keep UI reads cache-first. Add focused `sync/*` modules for orchestration, status, repositories, pulls, and issues. Commands become thin adapters that load auth/app state, call Sync Engine, emit existing update events, and return cached data or sync reports.

**Tech Stack:** Rust 1.82+, Tauri 2 commands, rusqlite/r2d2 SQLite cache, reqwest GitHub REST helpers, serde serialization, existing Vitest frontend suite.

---

## File Structure

- Create `src-tauri/src/sync/types.rs`: shared `SyncScope`, `SyncStepStatus`, `SyncErrorSummary`, `SyncStepReport`, `SyncReport`, and `SyncStatus` structs.
- Create `src-tauri/src/sync/status.rs`: persist and read compact sync status from `sync_meta`.
- Create `src-tauri/src/cache/repos.rs`: SQLite helpers for accounts, repositories, and watched repo lookup.
- Modify `src-tauri/src/cache/mod.rs`: export `repos`.
- Create `src-tauri/src/sync/repos.rs`: GitHub `/user/repos` seeding plus DB persistence.
- Create `src-tauri/src/sync/pulls.rs`: watched-repo pull sync and report aggregation.
- Create `src-tauri/src/sync/issues.rs`: watched-repo issue sync and report aggregation.
- Create `src-tauri/src/sync/engine.rs`: orchestrates scoped syncs and status persistence.
- Modify `src-tauri/src/sync/mod.rs`: export new modules.
- Modify `src-tauri/src/commands/sync.rs`: make `cmd_sync_now` call Sync Engine and add `cmd_get_sync_status`.
- Modify `src-tauri/src/lib.rs`: register `cmd_get_sync_status`.
- Modify `src-tauri/src/commands/pulls.rs`: keep cached reads, but route background refresh through Sync Engine.
- Modify `src-tauri/src/commands/issues.rs`: keep cached reads, but route background refresh through Sync Engine.

## Task 1: Add Sync Report Types

**Files:**
- Create: `src-tauri/src/sync/types.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: Write failing serialization tests**

Add `src-tauri/src/sync/types.rs` with tests first:

```rust
use serde::{Deserialize, Serialize};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::client::RateLimitInfo;

    #[test]
    fn sync_report_serializes_scope_status_and_errors() {
        let report = SyncReport {
            started_at_epoch: 10,
            finished_at_epoch: 20,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
            }),
            steps: vec![SyncStepReport {
                scope: SyncScope::Pulls,
                status: SyncStepStatus::Partial,
                repos_seen: 2,
                items_written: 1,
                errors: vec![SyncErrorSummary {
                    repo: Some("octocat/beta".to_string()),
                    operation: "list_pull_requests".to_string(),
                    message: "GitHub API error (HTTP 500): unavailable".to_string(),
                }],
            }],
        };

        let json = serde_json::to_string(&report).unwrap();
        assert!(json.contains("\"scope\":\"pulls\""));
        assert!(json.contains("\"status\":\"partial\""));
        assert!(json.contains("\"items_written\":1"));
        assert!(json.contains("octocat/beta"));
    }

    #[test]
    fn empty_sync_status_is_not_running() {
        let status = SyncStatus::empty();
        assert!(!status.is_running);
        assert!(status.last_report.is_none());
        assert!(status.last_finished_at_epoch.is_none());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test sync::types -- --nocapture
```

Expected: compile failure because `SyncReport`, `SyncScope`, `SyncStepStatus`, `SyncErrorSummary`, and `SyncStatus` are not implemented.

- [ ] **Step 3: Implement types**

Replace `src-tauri/src/sync/types.rs` with:

```rust
use serde::{Deserialize, Serialize};

use crate::github::client::RateLimitInfo;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncScope {
    Repositories,
    Pulls,
    Issues,
}

impl SyncScope {
    pub fn as_str(self) -> &'static str {
        match self {
            SyncScope::Repositories => "repositories",
            SyncScope::Pulls => "pulls",
            SyncScope::Issues => "issues",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStepStatus {
    Success,
    Partial,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncErrorSummary {
    pub repo: Option<String>,
    pub operation: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStepReport {
    pub scope: SyncScope,
    pub status: SyncStepStatus,
    pub repos_seen: usize,
    pub items_written: usize,
    pub errors: Vec<SyncErrorSummary>,
}

impl SyncStepReport {
    pub fn success(scope: SyncScope, repos_seen: usize, items_written: usize) -> Self {
        Self {
            scope,
            status: SyncStepStatus::Success,
            repos_seen,
            items_written,
            errors: Vec::new(),
        }
    }

    pub fn skipped(scope: SyncScope, message: impl Into<String>) -> Self {
        Self {
            scope,
            status: SyncStepStatus::Skipped,
            repos_seen: 0,
            items_written: 0,
            errors: vec![SyncErrorSummary {
                repo: None,
                operation: scope.as_str().to_string(),
                message: message.into(),
            }],
        }
    }

    pub fn from_errors(
        scope: SyncScope,
        repos_seen: usize,
        items_written: usize,
        errors: Vec<SyncErrorSummary>,
    ) -> Self {
        let status = if errors.is_empty() {
            SyncStepStatus::Success
        } else if items_written > 0 {
            SyncStepStatus::Partial
        } else {
            SyncStepStatus::Failed
        };
        Self {
            scope,
            status,
            repos_seen,
            items_written,
            errors,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub started_at_epoch: u64,
    pub finished_at_epoch: u64,
    pub rate_limit: Option<RateLimitInfo>,
    pub steps: Vec<SyncStepReport>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub is_running: bool,
    pub last_started_at_epoch: Option<u64>,
    pub last_finished_at_epoch: Option<u64>,
    pub last_status: Option<String>,
    pub last_report: Option<SyncReport>,
    pub last_rate_limit: Option<RateLimitInfo>,
}

impl SyncStatus {
    pub fn empty() -> Self {
        Self {
            is_running: false,
            last_started_at_epoch: None,
            last_finished_at_epoch: None,
            last_status: None,
            last_report: None,
            last_rate_limit: None,
        }
    }
}
```

Modify `src-tauri/src/sync/mod.rs`:

```rust
pub mod poller;
pub mod types;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cargo test sync::types -- --nocapture
```

Expected: tests in `sync::types` pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/sync/mod.rs src-tauri/src/sync/types.rs
git commit -m "feat: Sync Engineのレポート型を追加"
```

## Task 2: Persist Sync Status in sync_meta

**Files:**
- Create: `src-tauri/src/sync/status.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: Write failing status persistence tests**

Create `src-tauri/src/sync/status.rs`:

```rust
use crate::db::SqlitePool;
use crate::sync::types::{SyncReport, SyncStatus};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::client::RateLimitInfo;
    use crate::sync::types::{SyncScope, SyncStepReport};
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    #[test]
    fn get_sync_status_returns_empty_before_first_sync() {
        let pool = pool();
        let status = get_sync_status(&pool).unwrap();
        assert!(!status.is_running);
        assert!(status.last_report.is_none());
    }

    #[test]
    fn persist_and_read_sync_report_roundtrip() {
        let pool = pool();
        let report = SyncReport {
            started_at_epoch: 10,
            finished_at_epoch: 20,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
            }),
            steps: vec![SyncStepReport::success(SyncScope::Repositories, 2, 2)],
        };

        persist_sync_report(&pool, &report).unwrap();
        let status = get_sync_status(&pool).unwrap();

        assert!(!status.is_running);
        assert_eq!(status.last_started_at_epoch, Some(10));
        assert_eq!(status.last_finished_at_epoch, Some(20));
        assert_eq!(status.last_status.as_deref(), Some("success"));
        assert_eq!(status.last_report.unwrap().steps[0].items_written, 2);
        assert_eq!(status.last_rate_limit.unwrap().remaining, 4999);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test sync::status -- --nocapture
```

Expected: compile failure because `persist_sync_report` and `get_sync_status` are missing.

- [ ] **Step 3: Implement status persistence**

Replace `src-tauri/src/sync/status.rs` with:

```rust
use rusqlite::{params, OptionalExtension};

use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::client::RateLimitInfo;
use crate::sync::types::{SyncReport, SyncStatus, SyncStepStatus};

const LAST_STARTED_AT: &str = "sync:last_started_at";
const LAST_FINISHED_AT: &str = "sync:last_finished_at";
const LAST_STATUS: &str = "sync:last_status";
const LAST_REPORT_JSON: &str = "sync:last_report_json";
const LAST_RATE_LIMIT_JSON: &str = "sync:last_rate_limit_json";

pub fn persist_sync_report(pool: &SqlitePool, report: &SyncReport) -> Result<(), CacheError> {
    set_meta(pool, LAST_STARTED_AT, &report.started_at_epoch.to_string())?;
    set_meta(pool, LAST_FINISHED_AT, &report.finished_at_epoch.to_string())?;
    set_meta(pool, LAST_STATUS, report_status(report))?;
    set_meta(pool, LAST_REPORT_JSON, &serde_json::to_string(report)?)?;
    if let Some(rate_limit) = &report.rate_limit {
        set_meta(pool, LAST_RATE_LIMIT_JSON, &serde_json::to_string(rate_limit)?)?;
    }
    Ok(())
}

pub fn get_sync_status(pool: &SqlitePool) -> Result<SyncStatus, CacheError> {
    let last_report = get_meta(pool, LAST_REPORT_JSON)?
        .map(|raw| serde_json::from_str::<SyncReport>(&raw))
        .transpose()?;
    let last_rate_limit = get_meta(pool, LAST_RATE_LIMIT_JSON)?
        .map(|raw| serde_json::from_str::<RateLimitInfo>(&raw))
        .transpose()?;

    Ok(SyncStatus {
        is_running: false,
        last_started_at_epoch: get_meta(pool, LAST_STARTED_AT)?.and_then(|v| v.parse().ok()),
        last_finished_at_epoch: get_meta(pool, LAST_FINISHED_AT)?.and_then(|v| v.parse().ok()),
        last_status: get_meta(pool, LAST_STATUS)?,
        last_report,
        last_rate_limit,
    })
}

fn report_status(report: &SyncReport) -> &'static str {
    if report
        .steps
        .iter()
        .any(|s| matches!(s.status, SyncStepStatus::Failed))
    {
        "failed"
    } else if report
        .steps
        .iter()
        .any(|s| matches!(s.status, SyncStepStatus::Partial))
    {
        "partial"
    } else {
        "success"
    }
}

fn set_meta(pool: &SqlitePool, key: &str, value: &str) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO sync_meta (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
        params![key, value, report_time_value()],
    )?;
    Ok(())
}

fn get_meta(pool: &SqlitePool, key: &str) -> Result<Option<String>, CacheError> {
    let conn = pool.get()?;
    let value = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value)
}

fn report_time_value() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}
```

Modify `src-tauri/src/sync/mod.rs`:

```rust
pub mod poller;
pub mod status;
pub mod types;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cargo test sync::status -- --nocapture
```

Expected: status tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/sync/mod.rs src-tauri/src/sync/status.rs
git commit -m "feat: 同期ステータス永続化を追加"
```

## Task 3: Add Repository Cache Helpers and Repository Sync

**Files:**
- Create: `src-tauri/src/cache/repos.rs`
- Modify: `src-tauri/src/cache/mod.rs`
- Create: `src-tauri/src/sync/repos.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: Write failing cache and sync tests**

Create `src-tauri/src/cache/repos.rs`:

```rust
use crate::auth::pat::PatUser;
use crate::db::SqlitePool;
use crate::github::types::Repository;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WatchedRepo {
    pub id: i64,
    pub full_name: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::User;
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    fn pat_user(id: u64, login: &str) -> PatUser {
        PatUser {
            id,
            login: login.to_string(),
            name: None,
            email: None,
            avatar_url: format!("https://github.com/{login}.png"),
        }
    }

    fn repo(id: u64, full_name: &str, default_branch: &str) -> Repository {
        let (owner, name) = full_name.split_once('/').unwrap();
        Repository {
            id,
            name: name.to_string(),
            full_name: full_name.to_string(),
            private: false,
            owner: User {
                id: 1,
                login: owner.to_string(),
                avatar_url: format!("https://github.com/{owner}.png"),
                html_url: format!("https://github.com/{owner}"),
                name: None,
            },
            html_url: format!("https://github.com/{full_name}"),
            description: None,
            fork: false,
            default_branch: default_branch.to_string(),
        }
    }

    #[test]
    fn upsert_repo_preserves_existing_watch_choice() {
        let pool = pool();
        let account_id = upsert_account(&pool, &pat_user(2, "octocat"), "10").unwrap();
        upsert_repo(&pool, account_id, &repo(100, "octocat/alpha", "main")).unwrap();
        pool.get()
            .unwrap()
            .execute("UPDATE repos SET is_watched = 0 WHERE id = 100", [])
            .unwrap();

        upsert_repo(&pool, account_id, &repo(100, "octocat/alpha", "trunk")).unwrap();

        let conn = pool.get().unwrap();
        let (is_watched, default_branch): (i64, String) = conn
            .query_row(
                "SELECT is_watched, default_branch FROM repos WHERE id = 100",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_watched, 0);
        assert_eq!(default_branch, "trunk");
    }
}
```

Create `src-tauri/src/sync/repos.rs`:

```rust
use crate::auth::pat::PatUser;
use crate::db::SqlitePool;
use crate::github::types::Repository;
use crate::sync::types::SyncStepReport;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::User;
    use crate::sync::types::{SyncScope, SyncStepStatus};
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    fn user() -> PatUser {
        PatUser {
            id: 2,
            login: "octocat".to_string(),
            name: None,
            email: None,
            avatar_url: "https://github.com/octocat.png".to_string(),
        }
    }

    fn repo(id: u64, full_name: &str) -> Repository {
        let (owner, name) = full_name.split_once('/').unwrap();
        Repository {
            id,
            name: name.to_string(),
            full_name: full_name.to_string(),
            private: false,
            owner: User {
                id: 1,
                login: owner.to_string(),
                avatar_url: "https://github.com/avatar.png".to_string(),
                html_url: format!("https://github.com/{owner}"),
                name: None,
            },
            html_url: format!("https://github.com/{full_name}"),
            description: None,
            fork: false,
            default_branch: "main".to_string(),
        }
    }

    #[test]
    fn persist_repositories_writes_account_repos_and_success_report() {
        let pool = pool();
        let report = persist_repositories(
            &pool,
            &user(),
            &[repo(100, "octocat/alpha"), repo(101, "octocat/beta")],
            "10",
        )
        .unwrap();

        assert_eq!(report.scope, SyncScope::Repositories);
        assert_eq!(report.status, SyncStepStatus::Success);
        assert_eq!(report.items_written, 2);
        assert_eq!(crate::cache::repos::list_watched_repos(&pool).unwrap().len(), 2);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test "repos::tests" -- --nocapture
```

Expected: compile failures for missing `upsert_account`, `upsert_repo`, `list_watched_repos`, and `persist_repositories`.

- [ ] **Step 3: Implement repository cache helpers**

Implement these public functions in `src-tauri/src/cache/repos.rs` below the `WatchedRepo` struct:

```rust
use rusqlite::params;

use crate::cache::CacheError;

pub fn upsert_account(
    pool: &SqlitePool,
    user: &PatUser,
    created_at: &str,
) -> Result<i64, CacheError> {
    let conn = pool.get()?;
    let account_id = user.id as i64;
    conn.execute("UPDATE accounts SET is_active = 0", [])?;
    conn.execute(
        "INSERT INTO accounts (id, login, host, avatar_url, is_active, created_at)
         VALUES (?1, ?2, 'github.com', ?3, 1, ?4)
         ON CONFLICT(id) DO UPDATE SET
            login = excluded.login,
            avatar_url = excluded.avatar_url,
            is_active = 1",
        params![account_id, user.login, user.avatar_url, created_at],
    )?;
    Ok(account_id)
}

pub fn upsert_repo(
    pool: &SqlitePool,
    account_id: i64,
    repo: &Repository,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO repos (id, account_id, full_name, is_watched, default_branch)
         VALUES (?1, ?2, ?3, 1, ?4)
         ON CONFLICT(id) DO UPDATE SET
            account_id = excluded.account_id,
            full_name = excluded.full_name,
            default_branch = excluded.default_branch",
        params![
            repo.id as i64,
            account_id,
            repo.full_name,
            repo.default_branch
        ],
    )?;
    Ok(())
}

pub fn list_watched_repos(pool: &SqlitePool) -> Result<Vec<WatchedRepo>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, full_name
         FROM repos
         WHERE is_watched = 1
         ORDER BY full_name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WatchedRepo {
            id: row.get(0)?,
            full_name: row.get(1)?,
        })
    })?;
    let mut repos = Vec::new();
    for row in rows {
        repos.push(row?);
    }
    Ok(repos)
}
```

Modify `src-tauri/src/cache/mod.rs`:

```rust
pub mod issues;
pub mod meta;
pub mod notifications;
pub mod pulls;
pub mod repos;
```

- [ ] **Step 4: Implement repository sync helper**

Implement `src-tauri/src/sync/repos.rs` above the tests:

```rust
use crate::cache::repos::{list_watched_repos, upsert_account, upsert_repo, WatchedRepo};
use crate::github::client::GithubClient;
use crate::github::rest::list_repos_for_authenticated_user;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport};

pub async fn sync_repositories(
    pool: &SqlitePool,
    client: &GithubClient,
    user: &PatUser,
    now: &str,
) -> SyncStepReport {
    match list_repos_for_authenticated_user(client).await {
        Ok(repos) => persist_repositories(pool, user, &repos, now).unwrap_or_else(|e| {
            SyncStepReport::from_errors(
                SyncScope::Repositories,
                0,
                0,
                vec![SyncErrorSummary {
                    repo: None,
                    operation: "persist_repositories".to_string(),
                    message: e,
                }],
            )
        }),
        Err(e) => SyncStepReport::from_errors(
            SyncScope::Repositories,
            0,
            0,
            vec![SyncErrorSummary {
                repo: None,
                operation: "list_repos_for_authenticated_user".to_string(),
                message: e.to_string(),
            }],
        ),
    }
}

pub fn persist_repositories(
    pool: &SqlitePool,
    user: &PatUser,
    repos: &[Repository],
    now: &str,
) -> Result<SyncStepReport, String> {
    let account_id = upsert_account(pool, user, now).map_err(|e| e.to_string())?;
    let mut errors = Vec::new();
    let mut written = 0usize;

    for repo in repos {
        match upsert_repo(pool, account_id, repo) {
            Ok(()) => written += 1,
            Err(e) => errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "upsert_repo".to_string(),
                message: e.to_string(),
            }),
        }
    }

    Ok(SyncStepReport::from_errors(
        SyncScope::Repositories,
        repos.len(),
        written,
        errors,
    ))
}

pub fn watched_repos(pool: &SqlitePool) -> Result<Vec<WatchedRepo>, String> {
    list_watched_repos(pool).map_err(|e| e.to_string())
}
```

Modify `src-tauri/src/sync/mod.rs`:

```rust
pub mod poller;
pub mod repos;
pub mod status;
pub mod types;
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cargo test "repos::tests" -- --nocapture
```

Expected: repository cache and sync repository tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/cache/mod.rs src-tauri/src/cache/repos.rs src-tauri/src/sync/mod.rs src-tauri/src/sync/repos.rs
git commit -m "feat: リポジトリ同期基盤を追加"
```

## Task 4: Add Pull and Issue Sync Steps

**Files:**
- Create: `src-tauri/src/sync/pulls.rs`
- Create: `src-tauri/src/sync/issues.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: Write failing pure aggregation tests**

Create `src-tauri/src/sync/pulls.rs`:

```rust
use crate::cache::repos::WatchedRepo;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::types::PullRequest;
use crate::sync::types::SyncStepReport;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{PrRef, User};
    use crate::sync::types::{SyncScope, SyncStepStatus};
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool.get().unwrap().execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '10')",
            [],
        ).unwrap();
        pool.get().unwrap().execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (100, 1, 'octocat/alpha', 1)",
            [],
        ).unwrap();
        pool
    }

    fn pr(number: u32) -> PullRequest {
        PullRequest {
            id: number as u64,
            number,
            title: format!("pr {number}"),
            state: "open".to_string(),
            draft: false,
            html_url: format!("https://github.com/octocat/alpha/pull/{number}"),
            user: User {
                id: 1,
                login: "octocat".to_string(),
                avatar_url: "https://github.com/octocat.png".to_string(),
                html_url: "https://github.com/octocat".to_string(),
                name: None,
            },
            body: None,
            created_at: "2026-04-30T00:00:00Z".to_string(),
            updated_at: "2026-04-30T00:00:00Z".to_string(),
            merged_at: None,
            head: PrRef {
                label: "octocat:feature".to_string(),
                ref_name: "feature".to_string(),
                sha: "abc".to_string(),
                repo: None,
            },
            base: PrRef {
                label: "octocat:main".to_string(),
                ref_name: "main".to_string(),
                sha: "def".to_string(),
                repo: None,
            },
            requested_reviewers: Vec::new(),
        }
    }

    #[test]
    fn record_pull_result_reports_partial_and_writes_successful_items() {
        let pool = pool();
        let repo = WatchedRepo {
            id: 100,
            full_name: "octocat/alpha".to_string(),
        };
        let mut errors = Vec::new();
        let written = record_pull_result(&pool, &repo, Ok(vec![pr(1)]), "10", &mut errors);
        let failed = record_pull_result(
            &pool,
            &WatchedRepo {
                id: 101,
                full_name: "octocat/beta".to_string(),
            },
            Err("boom".to_string()),
            "10",
            &mut errors,
        );
        let report = pull_report(2, written + failed, errors);

        assert_eq!(report.scope, SyncScope::Pulls);
        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.items_written, 1);
        assert_eq!(report.errors.len(), 1);
    }
}
```

Create `src-tauri/src/sync/issues.rs`:

```rust
use crate::cache::repos::WatchedRepo;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::types::Issue;
use crate::sync::types::SyncStepReport;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{Label, User};
    use crate::sync::types::{SyncScope, SyncStepStatus};
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool.get()
            .unwrap()
            .execute(
                "INSERT INTO accounts (id, login, host, is_active, created_at)
                 VALUES (1, 'octocat', 'github.com', 1, '10')",
                [],
            )
            .unwrap();
        pool.get()
            .unwrap()
            .execute(
                "INSERT INTO repos (id, account_id, full_name, is_watched)
                 VALUES (100, 1, 'octocat/alpha', 1)",
                [],
            )
            .unwrap();
        pool
    }

    fn issue(number: u32) -> Issue {
        Issue {
            id: number as u64,
            number,
            title: format!("issue {number}"),
            state: "open".to_string(),
            html_url: format!("https://github.com/octocat/alpha/issues/{number}"),
            user: User {
                id: 1,
                login: "octocat".to_string(),
                avatar_url: "https://github.com/octocat.png".to_string(),
                html_url: "https://github.com/octocat".to_string(),
                name: None,
            },
            body: None,
            labels: vec![Label {
                id: 1,
                name: "bug".to_string(),
                color: "ff0000".to_string(),
            }],
            assignees: Vec::new(),
            milestone: None,
            comments: 0,
            author_association: Some("OWNER".to_string()),
            created_at: "2026-04-30T00:00:00Z".to_string(),
            updated_at: "2026-04-30T00:00:00Z".to_string(),
            closed_at: None,
            pull_request: None,
        }
    }

    #[test]
    fn record_issue_result_reports_partial_and_writes_successful_items() {
        let pool = pool();
        let repo = WatchedRepo {
            id: 100,
            full_name: "octocat/alpha".to_string(),
        };
        let mut errors = Vec::new();
        let written = record_issue_result(&pool, &repo, Ok(vec![issue(1)]), "10", &mut errors);
        let failed = record_issue_result(
            &pool,
            &WatchedRepo {
                id: 101,
                full_name: "octocat/beta".to_string(),
            },
            Err("boom".to_string()),
            "10",
            &mut errors,
        );
        let report = issue_report(2, written + failed, errors);

        assert_eq!(report.scope, SyncScope::Issues);
        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.items_written, 1);
        assert_eq!(report.errors.len(), 1);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test sync::pulls::tests -- --nocapture
cargo test sync::issues::tests -- --nocapture
```

Expected: compile failures for missing `record_pull_result`, `pull_report`, `record_issue_result`, and `issue_report`.

- [ ] **Step 3: Implement pull sync**

Add to `src-tauri/src/sync/pulls.rs` above tests:

```rust
use crate::cache::pulls::upsert_pull;
use crate::github::rest::list_pull_requests;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport};

pub async fn sync_pulls(
    pool: &SqlitePool,
    client: &GithubClient,
    repos: &[WatchedRepo],
    now: &str,
) -> SyncStepReport {
    let mut errors = Vec::new();
    let mut written = 0usize;

    for repo in repos {
        let Some((owner, name)) = repo.full_name.split_once('/') else {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "parse_repo_full_name".to_string(),
                message: "repo full_name must be owner/name".to_string(),
            });
            continue;
        };
        let result = list_pull_requests(client, owner, name, "open")
            .await
            .map_err(|e| e.to_string());
        written += record_pull_result(pool, repo, result, now, &mut errors);
    }

    pull_report(repos.len(), written, errors)
}

pub fn record_pull_result(
    pool: &SqlitePool,
    repo: &WatchedRepo,
    result: Result<Vec<PullRequest>, String>,
    now: &str,
    errors: &mut Vec<SyncErrorSummary>,
) -> usize {
    match result {
        Ok(pulls) => {
            let mut written = 0usize;
            for pull in pulls {
                match upsert_pull(pool, repo.id, &pull, now) {
                    Ok(()) => written += 1,
                    Err(e) => errors.push(SyncErrorSummary {
                        repo: Some(repo.full_name.clone()),
                        operation: "upsert_pull".to_string(),
                        message: e.to_string(),
                    }),
                }
            }
            written
        }
        Err(message) => {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "list_pull_requests".to_string(),
                message,
            });
            0
        }
    }
}

pub fn pull_report(
    repos_seen: usize,
    items_written: usize,
    errors: Vec<SyncErrorSummary>,
) -> SyncStepReport {
    SyncStepReport::from_errors(SyncScope::Pulls, repos_seen, items_written, errors)
}
```

- [ ] **Step 4: Implement issue sync**

Add to `src-tauri/src/sync/issues.rs` above tests:

```rust
use crate::cache::issues::upsert_issue;
use crate::github::rest::list_issues;
use crate::github::types::Issue;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport};

pub async fn sync_issues(
    pool: &SqlitePool,
    client: &GithubClient,
    repos: &[WatchedRepo],
    now: &str,
) -> SyncStepReport {
    let mut errors = Vec::new();
    let mut written = 0usize;

    for repo in repos {
        let Some((owner, name)) = repo.full_name.split_once('/') else {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "parse_repo_full_name".to_string(),
                message: "repo full_name must be owner/name".to_string(),
            });
            continue;
        };
        let result = list_issues(client, owner, name, "open", &[])
            .await
            .map_err(|e| e.to_string());
        written += record_issue_result(pool, repo, result, now, &mut errors);
    }

    issue_report(repos.len(), written, errors)
}

pub fn record_issue_result(
    pool: &SqlitePool,
    repo: &WatchedRepo,
    result: Result<Vec<Issue>, String>,
    now: &str,
    errors: &mut Vec<SyncErrorSummary>,
) -> usize {
    match result {
        Ok(issues) => {
            let mut written = 0usize;
            for issue in issues {
                match upsert_issue(pool, repo.id, &issue, now) {
                    Ok(()) => written += 1,
                    Err(e) => errors.push(SyncErrorSummary {
                        repo: Some(repo.full_name.clone()),
                        operation: "upsert_issue".to_string(),
                        message: e.to_string(),
                    }),
                }
            }
            written
        }
        Err(message) => {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "list_issues".to_string(),
                message,
            });
            0
        }
    }
}

pub fn issue_report(
    repos_seen: usize,
    items_written: usize,
    errors: Vec<SyncErrorSummary>,
) -> SyncStepReport {
    SyncStepReport::from_errors(SyncScope::Issues, repos_seen, items_written, errors)
}
```

Modify `src-tauri/src/sync/mod.rs`:

```rust
pub mod issues;
pub mod poller;
pub mod pulls;
pub mod repos;
pub mod status;
pub mod types;
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cargo test sync::pulls::tests -- --nocapture
cargo test sync::issues::tests -- --nocapture
```

Expected: pull and issue sync tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/sync/mod.rs src-tauri/src/sync/pulls.rs src-tauri/src/sync/issues.rs
git commit -m "feat: PRとIssueの同期ステップを追加"
```

## Task 5: Add Sync Engine and Commands

**Files:**
- Create: `src-tauri/src/sync/engine.rs`
- Modify: `src-tauri/src/sync/mod.rs`
- Modify: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing engine tests**

Create `src-tauri/src/sync/engine.rs`:

```rust
use crate::auth::pat::PatUser;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::sync::types::{SyncReport, SyncScope};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::types::{SyncStepReport, SyncStepStatus};

    #[test]
    fn build_report_preserves_step_order_and_status() {
        let report = build_report(
            10,
            20,
            None,
            vec![
                SyncStepReport::success(SyncScope::Repositories, 2, 2),
                SyncStepReport::skipped(SyncScope::Pulls, "rate limit"),
            ],
        );

        assert_eq!(report.started_at_epoch, 10);
        assert_eq!(report.finished_at_epoch, 20);
        assert_eq!(report.steps[0].scope, SyncScope::Repositories);
        assert_eq!(report.steps[1].status, SyncStepStatus::Skipped);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test sync::engine -- --nocapture
```

Expected: compile failure because `build_report` is missing.

- [ ] **Step 3: Implement Sync Engine**

Replace `src-tauri/src/sync/engine.rs` with:

```rust
use std::time::{SystemTime, UNIX_EPOCH};

use crate::auth::pat::PatUser;
use crate::db::SqlitePool;
use crate::github::client::{GithubClient, RateLimitInfo};
use crate::github::rest::get_rate_limit;
use crate::sync::issues::sync_issues;
use crate::sync::pulls::sync_pulls;
use crate::sync::repos::{sync_repositories, watched_repos};
use crate::sync::status::persist_sync_report;
use crate::sync::types::{SyncReport, SyncScope, SyncStepReport};

pub struct SyncEngine<'a> {
    pool: &'a SqlitePool,
    client: GithubClient,
    user: PatUser,
}

impl<'a> SyncEngine<'a> {
    pub fn new(pool: &'a SqlitePool, token: String, user: PatUser) -> Self {
        Self {
            pool,
            client: GithubClient::new(token),
            user,
        }
    }

    pub async fn sync_now(&self, scopes: &[SyncScope]) -> Result<SyncReport, String> {
        let started = now_epoch_secs();
        let now = format!("@{}", started);
        let mut steps = Vec::new();

        if scopes.contains(&SyncScope::Repositories) {
            steps.push(sync_repositories(self.pool, &self.client, &self.user, &now).await);
        }

        let watched = watched_repos(self.pool)?;

        if scopes.contains(&SyncScope::Pulls) {
            steps.push(sync_pulls(self.pool, &self.client, &watched, &now).await);
        }

        if scopes.contains(&SyncScope::Issues) {
            steps.push(sync_issues(self.pool, &self.client, &watched, &now).await);
        }

        let rate_limit = get_rate_limit(&self.client).await.ok();
        let report = build_report(started, now_epoch_secs(), rate_limit, steps);
        persist_sync_report(self.pool, &report).map_err(|e| e.to_string())?;
        Ok(report)
    }
}

pub fn build_report(
    started_at_epoch: u64,
    finished_at_epoch: u64,
    rate_limit: Option<RateLimitInfo>,
    steps: Vec<SyncStepReport>,
) -> SyncReport {
    SyncReport {
        started_at_epoch,
        finished_at_epoch,
        rate_limit,
        steps,
    }
}

fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
```

Modify `src-tauri/src/sync/mod.rs`:

```rust
pub mod engine;
pub mod issues;
pub mod poller;
pub mod pulls;
pub mod repos;
pub mod status;
pub mod types;
```

- [ ] **Step 4: Update sync commands**

Replace `src-tauri/src/commands/sync.rs` with:

```rust
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::auth::pat::validate_pat;
use crate::auth::token_store::{load_last_account_id, load_token};
use crate::db::SqlitePool;
use crate::sync::engine::SyncEngine;
use crate::sync::status::get_sync_status;
use crate::sync::types::{SyncReport, SyncScope, SyncStatus};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNowResult {
    pub report: SyncReport,
}

pub async fn run_sync_for_scopes<R: Runtime>(
    app: &AppHandle<R>,
    scopes: &[SyncScope],
) -> Result<SyncReport, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    let http = reqwest::Client::new();
    let (user, _) = validate_pat(&http, &token)
        .await
        .map_err(|e| e.to_string())?;
    let engine = SyncEngine::new(pool.inner(), token, user);
    engine.sync_now(scopes).await
}

#[tauri::command]
pub async fn cmd_sync_now<R: Runtime>(app: AppHandle<R>) -> Result<SyncNowResult, String> {
    let report = run_sync_for_scopes(
        &app,
        &[SyncScope::Repositories, SyncScope::Pulls, SyncScope::Issues],
    )
    .await?;
    Ok(SyncNowResult { report })
}

#[tauri::command]
pub async fn cmd_get_sync_status<R: Runtime>(app: AppHandle<R>) -> Result<SyncStatus, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    get_sync_status(pool.inner()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_now_result_serializes_report() {
        let r = SyncNowResult {
            report: SyncReport {
                started_at_epoch: 1,
                finished_at_epoch: 2,
                rate_limit: None,
                steps: Vec::new(),
            },
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"report\""));
        assert!(json.contains("\"finishedAtEpoch\":2"));
    }

    #[test]
    fn commands_exist() {
        let _ = cmd_sync_now::<tauri::Wry>;
        let _ = cmd_get_sync_status::<tauri::Wry>;
    }
}
```

Modify `src-tauri/src/lib.rs` in the `invoke_handler!` list:

```rust
commands::sync::cmd_sync_now,
commands::sync::cmd_get_sync_status,
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cargo test sync::engine -- --nocapture
cargo test commands::sync -- --nocapture
```

Expected: engine and command tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/sync/mod.rs src-tauri/src/sync/engine.rs src-tauri/src/commands/sync.rs src-tauri/src/lib.rs
git commit -m "feat: Sync Engineをコマンドに接続"
```

## Task 6: Route PR and Issue Background Refresh Through Sync Engine

**Files:**
- Modify: `src-tauri/src/commands/pulls.rs`
- Modify: `src-tauri/src/commands/issues.rs`

- [ ] **Step 1: Update pull refresh**

In `src-tauri/src/commands/pulls.rs`, add the import:

```rust
use crate::commands::sync::run_sync_for_scopes;
use crate::sync::types::SyncScope;
```

Replace the body of `refresh_pulls` with:

```rust
async fn refresh_pulls<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    run_sync_for_scopes(app, &[SyncScope::Repositories, SyncScope::Pulls]).await?;
    Ok(())
}
```

Remove the local `WatchedRepo` struct and any now-unused imports: `load_last_account_id`, `load_token`, `upsert_pull`, `GithubClient`, and `list_pull_requests`.

- [ ] **Step 2: Update issue refresh**

In `src-tauri/src/commands/issues.rs`, add the import:

```rust
use crate::commands::sync::run_sync_for_scopes;
use crate::sync::types::SyncScope;
```

Replace the body of `refresh_issues` with:

```rust
async fn refresh_issues<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    run_sync_for_scopes(app, &[SyncScope::Repositories, SyncScope::Issues]).await?;
    Ok(())
}
```

Remove now-unused imports: `upsert_issue`, `GithubClient`, and `list_issues` only if no other function in the file still uses them. Keep `load_last_account_id`, `load_token`, and `GithubClient` if detail/comment commands still need them.

- [ ] **Step 3: Run focused command tests**

Run:

```bash
cargo test commands::pulls -- --nocapture
cargo test commands::issues -- --nocapture
```

Expected: existing cached read and conversion tests pass.

- [ ] **Step 4: Run clippy for unused imports**

Run:

```bash
cargo clippy -- -D warnings
```

Expected: no unused import or dead code warnings.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/pulls.rs src-tauri/src/commands/issues.rs
git commit -m "refactor: PRとIssue更新をSync Engine経由に変更"
```

## Task 7: Final Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run Rust tests**

Run:

```bash
cargo test
```

Expected: all non-ignored Rust tests pass.

- [ ] **Step 2: Run Rust formatting and lint**

Run:

```bash
cargo fmt --check
cargo clippy -- -D warnings
```

Expected: formatting check passes and clippy reports no warnings.

- [ ] **Step 3: Run frontend tests and build**

Run from repo root:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: Vitest passes, oxlint reports 0 errors, and Vite build succeeds. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 4: Inspect sync status behavior manually**

Run the app with a valid token already saved:

```bash
pnpm tauri dev
```

In another terminal, inspect the app DB after triggering manual sync:

```bash
sqlite3 "$HOME/Library/Application Support/dev.ai1411.pulse/pulse.db" \
  "select key, substr(value, 1, 80) from sync_meta where key like 'sync:%' order by key;"
```

Expected: `sync:last_started_at`, `sync:last_finished_at`, `sync:last_status`, and `sync:last_report_json` exist. `sync:last_report_json` must not contain the access token.

- [ ] **Step 5: Confirm clean worktree**

Run:

```bash
git status --short --branch
```

Expected: either a clean branch or only intentional source changes already committed in prior tasks. Do not create an empty verification commit.
