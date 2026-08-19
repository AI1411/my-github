use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::types::PullRequest;
use rusqlite::{params, params_from_iter};

/// A row read back from the `pulls` table. Narrow to the fields consumers
/// care about; full payload remains in `raw_json` for forward compatibility.
#[derive(Debug, Clone, PartialEq)]
pub struct CachedPull {
    pub repo_id: i64,
    pub number: i64,
    pub title: String,
    pub state: String,
    pub is_draft: bool,
    pub author_login: Option<String>,
    pub head_ref: String,
    pub base_ref: String,
    pub updated_at: String,
    pub fetched_at: String,
}

/// Insert or update a pull request row keyed by `(repo_id, number)`.
pub fn upsert_pull_conn(
    conn: &rusqlite::Connection,
    repo_id: i64,
    pr: &PullRequest,
    fetched_at: &str,
) -> Result<(), CacheError> {
    let raw_json = serde_json::to_string(pr)?;
    conn.execute(
        "INSERT INTO pulls (
            repo_id, number, title, state, is_draft, author_login,
            head_ref, base_ref, ci_state, review_state, has_mention,
            raw_json, updated_at, fetched_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,NULL,NULL,0,?9,?10,?11)
         ON CONFLICT(repo_id, number) DO UPDATE SET
            title = excluded.title,
            state = excluded.state,
            is_draft = excluded.is_draft,
            author_login = excluded.author_login,
            head_ref = excluded.head_ref,
            base_ref = excluded.base_ref,
            raw_json = excluded.raw_json,
            updated_at = excluded.updated_at,
            fetched_at = excluded.fetched_at",
        params![
            repo_id,
            pr.number as i64,
            pr.title,
            pr.state,
            pr.draft as i64,
            pr.user.login,
            pr.head.ref_name,
            pr.base.ref_name,
            raw_json,
            pr.updated_at,
            fetched_at,
        ],
    )?;
    Ok(())
}

/// Insert or update a pull request row keyed by `(repo_id, number)`.
pub fn upsert_pull(
    pool: &SqlitePool,
    repo_id: i64,
    pr: &PullRequest,
    fetched_at: &str,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    upsert_pull_conn(&conn, repo_id, pr, fetched_at)
}

/// Update only `review_state` for a pull identified by repo full name + number.
pub fn update_pull_review_state(
    pool: &SqlitePool,
    repo_full_name: &str,
    number: i64,
    review_state: &str,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE pulls
         SET review_state = ?1
         WHERE number = ?2
           AND repo_id = (SELECT id FROM repos WHERE full_name = ?3 LIMIT 1)",
        params![review_state, number, repo_full_name],
    )?;
    Ok(())
}

/// Update pull `state` (and optionally mark merged via raw_json leave-as-is).
pub fn update_pull_state(
    pool: &SqlitePool,
    repo_full_name: &str,
    number: i64,
    state: &str,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE pulls
         SET state = ?1
         WHERE number = ?2
           AND repo_id = (SELECT id FROM repos WHERE full_name = ?3 LIMIT 1)",
        params![state, number, repo_full_name],
    )?;
    Ok(())
}

pub fn update_pull_draft(
    pool: &SqlitePool,
    repo_full_name: &str,
    number: i64,
    is_draft: bool,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE pulls
         SET is_draft = ?1
         WHERE number = ?2
           AND repo_id = (SELECT id FROM repos WHERE full_name = ?3 LIMIT 1)",
        params![if is_draft { 1i64 } else { 0i64 }, number, repo_full_name],
    )?;
    Ok(())
}

pub fn get_pull(
    pool: &SqlitePool,
    repo_id: i64,
    number: i64,
) -> Result<Option<CachedPull>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT repo_id, number, title, state, is_draft, author_login,
                head_ref, base_ref, updated_at, fetched_at
         FROM pulls WHERE repo_id = ?1 AND number = ?2",
    )?;
    let mut rows = stmt.query(params![repo_id, number])?;
    if let Some(row) = rows.next()? {
        Ok(Some(CachedPull {
            repo_id: row.get(0)?,
            number: row.get(1)?,
            title: row.get(2)?,
            state: row.get(3)?,
            is_draft: row.get::<_, i64>(4)? != 0,
            author_login: row.get(5)?,
            head_ref: row.get(6)?,
            base_ref: row.get(7)?,
            updated_at: row.get(8)?,
            fetched_at: row.get(9)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn list_pulls_by_repo(pool: &SqlitePool, repo_id: i64) -> Result<Vec<CachedPull>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT repo_id, number, title, state, is_draft, author_login,
                head_ref, base_ref, updated_at, fetched_at
         FROM pulls WHERE repo_id = ?1
         ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![repo_id], |row| {
        Ok(CachedPull {
            repo_id: row.get(0)?,
            number: row.get(1)?,
            title: row.get(2)?,
            state: row.get(3)?,
            is_draft: row.get::<_, i64>(4)? != 0,
            author_login: row.get(5)?,
            head_ref: row.get(6)?,
            base_ref: row.get(7)?,
            updated_at: row.get(8)?,
            fetched_at: row.get(9)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn delete_pulls_not_in_numbers_conn(
    conn: &rusqlite::Connection,
    repo_id: i64,
    numbers: &[i64],
) -> Result<usize, CacheError> {
    if numbers.is_empty() {
        return Ok(conn.execute(
            "DELETE FROM pulls WHERE repo_id = ?1 AND state = 'open'",
            params![repo_id],
        )?);
    }

    let placeholders = std::iter::repeat_n("?", numbers.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "DELETE FROM pulls
         WHERE repo_id = ? AND state = 'open' AND number NOT IN ({placeholders})"
    );
    let mut values = Vec::with_capacity(numbers.len() + 1);
    values.push(repo_id);
    values.extend_from_slice(numbers);
    Ok(conn.execute(&sql, params_from_iter(values))?)
}

pub fn delete_pulls_not_in_numbers(
    pool: &SqlitePool,
    repo_id: i64,
    numbers: &[i64],
) -> Result<usize, CacheError> {
    let conn = pool.get()?;
    delete_pulls_not_in_numbers_conn(&conn, repo_id, numbers)
}

/// Upsert open pulls and delete stale rows atomically for one repository.
pub fn persist_repo_pulls(
    pool: &SqlitePool,
    repo_id: i64,
    pulls: Vec<PullRequest>,
    now: &str,
) -> Result<usize, (Vec<String>, Option<String>)> {
    let numbers = pulls
        .iter()
        .map(|pull| pull.number as i64)
        .collect::<Vec<_>>();
    let mut conn = pool.get().map_err(|err| (vec![err.to_string()], None))?;
    let tx = conn
        .transaction()
        .map_err(|err| (vec![err.to_string()], None))?;
    let mut written = 0usize;
    let mut upsert_failures = Vec::new();
    for pull in pulls {
        match upsert_pull_conn(&tx, repo_id, &pull, now) {
            Ok(()) => written += 1,
            Err(err) => upsert_failures.push(err.to_string()),
        }
    }
    if !upsert_failures.is_empty() {
        return Err((upsert_failures, None));
    }
    let delete_error = delete_pulls_not_in_numbers_conn(&tx, repo_id, &numbers)
        .err()
        .map(|err| err.to_string());
    if let Some(delete_error) = delete_error {
        return Err((Vec::new(), Some(delete_error)));
    }
    tx.commit().map_err(|err| (vec![err.to_string()], None))?;
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{PrRef, PullRequest, User};
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
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (1, 1, 'octocat/hello', 1)",
            [],
        )
        .unwrap();
        pool
    }

    fn sample_pr(number: u32, title: &str, updated_at: &str) -> PullRequest {
        PullRequest {
            id: number as u64 + 1000,
            number,
            title: title.into(),
            state: "open".into(),
            draft: false,
            html_url: "https://github.com/octocat/hello/pull/1".into(),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: String::new(),
                html_url: String::new(),
                name: None,
            },
            body: None,
            created_at: "2026-04-20T00:00:00Z".into(),
            updated_at: updated_at.into(),
            merged_at: None,
            head: PrRef {
                label: "octocat:feature".into(),
                ref_name: "feature".into(),
                sha: "abc".into(),
                repo: None,
            },
            base: PrRef {
                label: "octocat:main".into(),
                ref_name: "main".into(),
                sha: "def".into(),
                repo: None,
            },
            requested_reviewers: vec![],
            requested_teams: vec![],
            mergeable: None,
            mergeable_state: None,
            labels: vec![],
        }
    }

    #[test]
    fn upsert_and_get_roundtrip() {
        let pool = test_pool();
        let pr = sample_pr(1, "hello", "2026-04-21T00:00:00Z");
        upsert_pull(&pool, 1, &pr, "2026-04-21T01:00:00Z").unwrap();
        let got = get_pull(&pool, 1, 1).unwrap().expect("row exists");
        assert_eq!(got.number, 1);
        assert_eq!(got.title, "hello");
        assert_eq!(got.state, "open");
        assert!(!got.is_draft);
        assert_eq!(got.head_ref, "feature");
        assert_eq!(got.base_ref, "main");
        assert_eq!(got.author_login.as_deref(), Some("octocat"));
        assert_eq!(got.fetched_at, "2026-04-21T01:00:00Z");
    }

    #[test]
    fn upsert_updates_existing_row() {
        let pool = test_pool();
        let pr1 = sample_pr(1, "v1", "2026-04-21T00:00:00Z");
        upsert_pull(&pool, 1, &pr1, "2026-04-21T01:00:00Z").unwrap();
        let pr2 = sample_pr(1, "v2", "2026-04-21T02:00:00Z");
        upsert_pull(&pool, 1, &pr2, "2026-04-21T03:00:00Z").unwrap();
        let got = get_pull(&pool, 1, 1).unwrap().unwrap();
        assert_eq!(got.title, "v2");
        assert_eq!(got.updated_at, "2026-04-21T02:00:00Z");
        assert_eq!(got.fetched_at, "2026-04-21T03:00:00Z");
    }

    #[test]
    fn get_pull_returns_none_for_missing() {
        let pool = test_pool();
        assert!(get_pull(&pool, 1, 999).unwrap().is_none());
    }

    #[test]
    fn list_pulls_by_repo_is_ordered_by_updated_desc() {
        let pool = test_pool();
        let older = sample_pr(1, "older", "2026-04-20T00:00:00Z");
        let newer = sample_pr(2, "newer", "2026-04-21T00:00:00Z");
        upsert_pull(&pool, 1, &older, "2026-04-21T00:00:00Z").unwrap();
        upsert_pull(&pool, 1, &newer, "2026-04-21T00:00:00Z").unwrap();
        let list = list_pulls_by_repo(&pool, 1).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].number, 2);
        assert_eq!(list[1].number, 1);
    }

    #[test]
    fn list_pulls_by_repo_returns_empty_for_unknown_repo() {
        let pool = test_pool();
        let list = list_pulls_by_repo(&pool, 999).unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn delete_pulls_not_in_numbers_removes_stale_open_rows_only() {
        let pool = test_pool();
        let keep = sample_pr(1, "keep", "2026-04-21T00:00:00Z");
        let stale = sample_pr(2, "stale", "2026-04-21T00:00:00Z");
        let mut closed = sample_pr(3, "closed", "2026-04-21T00:00:00Z");
        closed.state = "closed".into();
        upsert_pull(&pool, 1, &keep, "t1").unwrap();
        upsert_pull(&pool, 1, &stale, "t1").unwrap();
        upsert_pull(&pool, 1, &closed, "t1").unwrap();

        let deleted = delete_pulls_not_in_numbers(&pool, 1, &[1]).unwrap();
        let mut numbers = list_pulls_by_repo(&pool, 1)
            .unwrap()
            .into_iter()
            .map(|pull| pull.number)
            .collect::<Vec<_>>();
        numbers.sort();

        assert_eq!(deleted, 1);
        assert_eq!(numbers, vec![1, 3]);
    }

    #[test]
    fn delete_pulls_not_in_numbers_with_empty_numbers_removes_all_open_rows() {
        let pool = test_pool();
        let open = sample_pr(1, "open", "2026-04-21T00:00:00Z");
        let mut closed = sample_pr(2, "closed", "2026-04-21T00:00:00Z");
        closed.state = "closed".into();
        upsert_pull(&pool, 1, &open, "t1").unwrap();
        upsert_pull(&pool, 1, &closed, "t1").unwrap();

        let deleted = delete_pulls_not_in_numbers(&pool, 1, &[]).unwrap();
        let numbers = list_pulls_by_repo(&pool, 1)
            .unwrap()
            .into_iter()
            .map(|pull| pull.number)
            .collect::<Vec<_>>();

        assert_eq!(deleted, 1);
        assert_eq!(numbers, vec![2]);
    }

    #[test]
    fn update_pull_review_state_sets_column() {
        let pool = test_pool();
        upsert_pull(
            &pool,
            1,
            &sample_pr(1, "hello", "2026-04-21T00:00:00Z"),
            "t1",
        )
        .unwrap();
        update_pull_review_state(&pool, "octocat/hello", 1, "approved").unwrap();
        let conn = pool.get().unwrap();
        let state: String = conn
            .query_row(
                "SELECT review_state FROM pulls WHERE repo_id = 1 AND number = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(state, "approved");
    }
}
