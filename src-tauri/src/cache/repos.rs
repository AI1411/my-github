use crate::auth::pat::PatUser;
use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::types::Repository;
use rusqlite::params;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WatchedRepo {
    pub id: i64,
    pub full_name: String,
}

pub fn upsert_account(
    pool: &SqlitePool,
    user: &PatUser,
    created_at: &str,
) -> Result<i64, CacheError> {
    let mut conn = pool.get()?;
    let account_id = user.id as i64;
    let tx = conn.transaction()?;
    tx.execute("UPDATE accounts SET is_active = 0", [])?;
    tx.execute(
        "INSERT INTO accounts (id, login, host, avatar_url, is_active, created_at)
         VALUES (?1, ?2, 'github.com', ?3, 1, ?4)
         ON CONFLICT(id) DO UPDATE SET
            login = excluded.login,
            avatar_url = excluded.avatar_url,
            is_active = 1",
        params![account_id, user.login, user.avatar_url, created_at],
    )?;
    tx.commit()?;
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
        "SELECT r.id, r.full_name
         FROM repos r
         JOIN accounts a ON a.id = r.account_id
         WHERE r.is_watched = 1 AND a.is_active = 1
         ORDER BY r.full_name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WatchedRepo {
            id: row.get(0)?,
            full_name: row.get(1)?,
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
    use crate::auth::pat::PatUser;
    use crate::db::{init_pool, run_migrations, SqlitePool};
    use crate::github::types::{Repository, User};
    use std::path::Path;

    fn test_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    fn sample_pat_user() -> PatUser {
        PatUser {
            login: "octocat".into(),
            id: 1,
            name: Some("Mona Lisa".into()),
            email: Some("octocat@example.com".into()),
            avatar_url: "https://avatars.githubusercontent.com/u/1".into(),
        }
    }

    fn sample_owner() -> User {
        User {
            id: 1,
            login: "octocat".into(),
            avatar_url: "https://avatars.githubusercontent.com/u/1".into(),
            html_url: "https://github.com/octocat".into(),
            name: None,
        }
    }

    fn sample_repo(id: u64, full_name: &str, default_branch: &str) -> Repository {
        Repository {
            id,
            name: full_name
                .split('/')
                .next_back()
                .unwrap_or("repo")
                .to_string(),
            full_name: full_name.to_string(),
            private: false,
            owner: sample_owner(),
            html_url: format!("https://github.com/{full_name}"),
            description: None,
            fork: false,
            default_branch: default_branch.to_string(),
        }
    }

    #[test]
    fn upsert_repo_preserves_existing_watch_choice() {
        let pool = test_pool();
        let user = sample_pat_user();
        let account_id = upsert_account(&pool, &user, "2026-04-30T00:00:00Z").unwrap();
        upsert_repo(
            &pool,
            account_id,
            &sample_repo(100, "octocat/hello", "main"),
        )
        .unwrap();

        let conn = pool.get().unwrap();
        conn.execute("UPDATE repos SET is_watched = 0 WHERE id = 100", [])
            .unwrap();
        drop(conn);

        upsert_repo(
            &pool,
            account_id,
            &sample_repo(100, "octocat/hello", "trunk"),
        )
        .unwrap();

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

    #[test]
    fn list_watched_repos_returns_only_active_account_repos() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-04-30T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (2, 'inactive', 'github.com', 0, '2026-04-30T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched, default_branch)
             VALUES (100, 1, 'octocat/active', 1, 'main')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched, default_branch)
             VALUES (101, 2, 'inactive/repo', 1, 'main')",
            [],
        )
        .unwrap();
        drop(conn);

        let repos = list_watched_repos(&pool).unwrap();

        assert_eq!(
            repos,
            vec![WatchedRepo {
                id: 100,
                full_name: "octocat/active".to_string(),
            }]
        );
    }
}
