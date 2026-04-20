use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::types::Issue;
use rusqlite::params;

/// A row read back from the `issues` table. Labels are denormalised as a
/// JSON-encoded array of label names; full payload remains in `raw_json`.
#[derive(Debug, Clone, PartialEq)]
pub struct CachedIssue {
    pub repo_id: i64,
    pub number: i64,
    pub title: String,
    pub state: String,
    pub author_login: Option<String>,
    pub labels: Vec<String>,
    pub updated_at: String,
    pub fetched_at: String,
}

pub fn upsert_issue(
    pool: &SqlitePool,
    repo_id: i64,
    issue: &Issue,
    fetched_at: &str,
) -> Result<(), CacheError> {
    let raw_json = serde_json::to_string(issue)?;
    let labels_json = serde_json::to_string(
        &issue
            .labels
            .iter()
            .map(|l| l.name.as_str())
            .collect::<Vec<_>>(),
    )?;
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO issues (
            repo_id, number, title, state, author_login, labels, assignees,
            raw_json, updated_at, fetched_at
         ) VALUES (?1,?2,?3,?4,?5,?6,NULL,?7,?8,?9)
         ON CONFLICT(repo_id, number) DO UPDATE SET
            title = excluded.title,
            state = excluded.state,
            author_login = excluded.author_login,
            labels = excluded.labels,
            raw_json = excluded.raw_json,
            updated_at = excluded.updated_at,
            fetched_at = excluded.fetched_at",
        params![
            repo_id,
            issue.number as i64,
            issue.title,
            issue.state,
            issue.user.login,
            labels_json,
            raw_json,
            issue.updated_at,
            fetched_at,
        ],
    )?;
    Ok(())
}

pub fn list_issues_by_repo(
    pool: &SqlitePool,
    repo_id: i64,
) -> Result<Vec<CachedIssue>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT repo_id, number, title, state, author_login, labels,
                updated_at, fetched_at
         FROM issues WHERE repo_id = ?1
         ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![repo_id], |row| {
        let labels_raw: Option<String> = row.get(5)?;
        let labels: Vec<String> = labels_raw
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();
        Ok(CachedIssue {
            repo_id: row.get(0)?,
            number: row.get(1)?,
            title: row.get(2)?,
            state: row.get(3)?,
            author_login: row.get(4)?,
            labels,
            updated_at: row.get(6)?,
            fetched_at: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::types::{Issue, Label, User};
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

    fn sample_issue(number: u32, title: &str, updated_at: &str, labels: Vec<&str>) -> Issue {
        Issue {
            id: number as u64 + 2000,
            number,
            title: title.into(),
            state: "open".into(),
            html_url: "https://github.com/octocat/hello/issues/1".into(),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: String::new(),
                html_url: String::new(),
                name: None,
            },
            body: None,
            labels: labels
                .into_iter()
                .enumerate()
                .map(|(i, name)| Label {
                    id: i as u64,
                    name: name.into(),
                    color: "ffffff".into(),
                })
                .collect(),
            created_at: "2026-04-20T00:00:00Z".into(),
            updated_at: updated_at.into(),
            closed_at: None,
            pull_request: None,
        }
    }

    #[test]
    fn upsert_and_list_roundtrip() {
        let pool = test_pool();
        let issue = sample_issue(1, "bug: broken", "2026-04-21T00:00:00Z", vec!["bug", "p0"]);
        upsert_issue(&pool, 1, &issue, "2026-04-21T01:00:00Z").unwrap();
        let list = list_issues_by_repo(&pool, 1).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].number, 1);
        assert_eq!(list[0].title, "bug: broken");
        assert_eq!(list[0].labels, vec!["bug".to_string(), "p0".to_string()]);
        assert_eq!(list[0].author_login.as_deref(), Some("octocat"));
    }

    #[test]
    fn upsert_overwrites_existing_issue() {
        let pool = test_pool();
        let a = sample_issue(1, "v1", "2026-04-20T00:00:00Z", vec!["bug"]);
        upsert_issue(&pool, 1, &a, "t1").unwrap();
        let b = sample_issue(1, "v2", "2026-04-21T00:00:00Z", vec!["enhancement"]);
        upsert_issue(&pool, 1, &b, "t2").unwrap();
        let list = list_issues_by_repo(&pool, 1).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "v2");
        assert_eq!(list[0].labels, vec!["enhancement".to_string()]);
        assert_eq!(list[0].fetched_at, "t2");
    }

    #[test]
    fn list_is_ordered_by_updated_desc() {
        let pool = test_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "old", "2026-04-18T00:00:00Z", vec![]),
            "t1",
        )
        .unwrap();
        upsert_issue(
            &pool,
            1,
            &sample_issue(2, "new", "2026-04-21T00:00:00Z", vec![]),
            "t2",
        )
        .unwrap();
        let list = list_issues_by_repo(&pool, 1).unwrap();
        assert_eq!(list[0].number, 2);
        assert_eq!(list[1].number, 1);
    }

    #[test]
    fn list_returns_empty_for_unknown_repo() {
        let pool = test_pool();
        assert!(list_issues_by_repo(&pool, 42).unwrap().is_empty());
    }
}
