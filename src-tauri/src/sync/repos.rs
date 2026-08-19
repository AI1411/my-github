use crate::auth::pat::PatUser;
use crate::cache::repos::{list_watched_repos, upsert_account, upsert_repo, WatchedRepo};
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::list_repos_for_authenticated_user;
use crate::github::types::Repository;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport, SyncStepStatus};

pub async fn sync_repositories(
    pool: &SqlitePool,
    client: &GithubClient,
    user: &PatUser,
    now: &str,
) -> SyncStepReport {
    match list_repos_for_authenticated_user(client).await {
        Ok(repos) => {
            let host = crate::github::host::host_label_from_api_base(client.base_url());
            persist_repositories(pool, user, &repos, now, &host)
                .unwrap_or_else(|message| repository_persistence_error_report(repos.len(), message))
        }
        Err(err) => SyncStepReport::from_errors(
            SyncScope::Repositories,
            0,
            0,
            vec![SyncErrorSummary {
                repo: None,
                operation: "list_repos_for_authenticated_user".to_string(),
                message: err.to_string(),
            }],
        ),
    }
}

fn repository_persistence_error_report(repos_seen: usize, message: String) -> SyncStepReport {
    SyncStepReport {
        scope: SyncScope::Repositories,
        status: SyncStepStatus::Failed,
        repos_seen,
        items_written: 0,
        errors: vec![SyncErrorSummary {
            repo: None,
            operation: "persist_repositories".to_string(),
            message,
        }],
    }
}

pub fn persist_repositories(
    pool: &SqlitePool,
    user: &PatUser,
    repos: &[Repository],
    now: &str,
    host: &str,
) -> Result<SyncStepReport, String> {
    let account_id = upsert_account(pool, user, now, host).map_err(|err| err.to_string())?;
    let mut written = 0usize;
    let mut errors = Vec::new();

    for repo in repos {
        match upsert_repo(pool, account_id, repo) {
            Ok(()) => written += 1,
            Err(err) => errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "upsert_repo".to_string(),
                message: err.to_string(),
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
    list_watched_repos(pool).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::pat::PatUser;
    use crate::db::{init_pool, run_migrations, SqlitePool};
    use crate::github::types::{Repository, User};
    use crate::sync::types::{SyncScope, SyncStepStatus};
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

    fn sample_repo(id: u64, full_name: &str) -> Repository {
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
            default_branch: "main".into(),
        }
    }

    #[test]
    fn persist_repositories_writes_account_repos_and_success_report() {
        let pool = test_pool();
        let user = sample_pat_user();
        let repos = vec![
            sample_repo(100, "octocat/alpha"),
            sample_repo(101, "octocat/beta"),
        ];

        let report =
            persist_repositories(&pool, &user, &repos, "2026-04-30T00:00:00Z", "github.com")
                .unwrap();

        assert_eq!(report.scope, SyncScope::Repositories);
        assert_eq!(report.status, SyncStepStatus::Success);
        assert_eq!(report.items_written, 2);
        assert_eq!(watched_repos(&pool).unwrap().len(), 2);
    }

    #[test]
    fn repository_persistence_error_report_is_failed_for_step_setup_failure() {
        let report =
            repository_persistence_error_report(2, "sqlite pool error: broken".to_string());

        assert_eq!(report.scope, SyncScope::Repositories);
        assert_eq!(report.status, SyncStepStatus::Failed);
        assert_eq!(report.repos_seen, 2);
        assert_eq!(report.items_written, 0);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "persist_repositories");
    }
}
