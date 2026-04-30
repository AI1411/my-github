use crate::cache::pulls::{delete_pulls_not_in_numbers, upsert_pull};
use crate::cache::repos::WatchedRepo;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::list_pull_requests;
use crate::github::types::PullRequest;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport};

pub async fn sync_pulls(
    pool: &SqlitePool,
    client: &GithubClient,
    repos: &[WatchedRepo],
    now: &str,
) -> SyncStepReport {
    let mut items_written = 0usize;
    let mut errors = Vec::new();

    for repo in repos {
        let Some((owner, name)) = parse_repo_full_name(repo, &mut errors) else {
            continue;
        };
        let result = list_pull_requests(client, owner, name, "open")
            .await
            .map_err(|err| err.to_string());
        items_written += record_pull_result(pool, repo, result, now, &mut errors);
    }

    pull_report(repos.len(), items_written, errors)
}

pub fn record_pull_result(
    pool: &SqlitePool,
    repo: &WatchedRepo,
    result: Result<Vec<PullRequest>, String>,
    now: &str,
    errors: &mut Vec<SyncErrorSummary>,
) -> usize {
    let pulls = match result {
        Ok(pulls) => pulls,
        Err(message) => {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "list_pull_requests".to_string(),
                message,
            });
            return 0;
        }
    };

    let numbers = pulls
        .iter()
        .map(|pull| pull.number as i64)
        .collect::<Vec<_>>();
    let mut written = 0usize;
    let mut upsert_failures = Vec::new();
    for pull in pulls {
        match upsert_pull(pool, repo.id, &pull, now) {
            Ok(()) => written += 1,
            Err(err) => upsert_failures.push(err.to_string()),
        }
    }
    let delete_error = delete_pulls_not_in_numbers(pool, repo.id, &numbers)
        .err()
        .map(|err| err.to_string());
    match (upsert_failures.first(), delete_error) {
        (Some(first_error), Some(delete_error)) => errors.push(SyncErrorSummary {
            repo: Some(repo.full_name.clone()),
            operation: "persist_pull_cache".to_string(),
            message: format!(
                "{} pull upsert(s) failed; first error: {}; delete error: {}",
                upsert_failures.len(),
                first_error,
                delete_error
            ),
        }),
        (Some(first_error), None) => errors.push(SyncErrorSummary {
            repo: Some(repo.full_name.clone()),
            operation: "upsert_pull".to_string(),
            message: format!(
                "{} pull upsert(s) failed; first error: {}",
                upsert_failures.len(),
                first_error
            ),
        }),
        (None, Some(delete_error)) => errors.push(SyncErrorSummary {
            repo: Some(repo.full_name.clone()),
            operation: "delete_pulls_not_in_numbers".to_string(),
            message: delete_error,
        }),
        (None, None) => {}
    }
    written
}

pub fn pull_report(
    repos_seen: usize,
    items_written: usize,
    errors: Vec<SyncErrorSummary>,
) -> SyncStepReport {
    SyncStepReport::from_errors(SyncScope::Pulls, repos_seen, items_written, errors)
}

fn parse_repo_full_name<'a>(
    repo: &'a WatchedRepo,
    errors: &mut Vec<SyncErrorSummary>,
) -> Option<(&'a str, &'a str)> {
    let mut parts = repo.full_name.split('/');
    let owner = parts.next().unwrap_or_default();
    let name = parts.next().unwrap_or_default();
    if owner.is_empty() || name.is_empty() || parts.next().is_some() {
        errors.push(SyncErrorSummary {
            repo: Some(repo.full_name.clone()),
            operation: "parse_repo_full_name".to_string(),
            message: format!("invalid repository full_name: {}", repo.full_name),
        });
        return None;
    }
    Some((owner, name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::pulls::list_pulls_by_repo;
    use crate::cache::repos::WatchedRepo;
    use crate::db::{init_pool, run_migrations, SqlitePool};
    use crate::github::client::GithubClient;
    use crate::github::types::{PrRef, PullRequest, User};
    use crate::sync::types::{SyncScope, SyncStepStatus};
    use std::path::Path;

    fn test_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-04-30T00:00:00Z')",
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

    fn sample_pr(number: u32, title: &str) -> PullRequest {
        PullRequest {
            id: number as u64 + 1000,
            number,
            title: title.into(),
            state: "open".into(),
            draft: false,
            html_url: format!("https://github.com/octocat/hello/pull/{number}"),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: String::new(),
                html_url: String::new(),
                name: None,
            },
            body: None,
            created_at: "2026-04-29T00:00:00Z".into(),
            updated_at: "2026-04-30T00:00:00Z".into(),
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
        }
    }

    #[test]
    fn record_pull_result_reports_partial_and_writes_successful_items() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "CREATE TRIGGER fail_second_pull BEFORE INSERT ON pulls
             WHEN NEW.number = 2 BEGIN
                SELECT RAISE(FAIL, 'forced pull failure');
             END",
            [],
        )
        .unwrap();
        drop(conn);

        let repo = WatchedRepo {
            id: 1,
            full_name: "octocat/hello".into(),
        };
        let mut errors = Vec::new();

        let written = record_pull_result(
            &pool,
            &repo,
            Ok(vec![sample_pr(1, "first"), sample_pr(2, "second")]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        );
        let report = pull_report(1, written, errors);

        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.items_written, 1);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "upsert_pull");
        assert_eq!(list_pulls_by_repo(&pool, 1).unwrap().len(), 1);
    }

    #[test]
    fn record_pull_result_deletes_stale_open_cache_after_successful_api_result() {
        let pool = test_pool();
        let repo = WatchedRepo {
            id: 1,
            full_name: "octocat/hello".into(),
        };
        upsert_pull(&pool, 1, &sample_pr(1, "current"), "t0").unwrap();
        upsert_pull(&pool, 1, &sample_pr(2, "stale"), "t0").unwrap();
        let mut errors = Vec::new();

        let written = record_pull_result(
            &pool,
            &repo,
            Ok(vec![sample_pr(1, "current")]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        );
        let numbers = list_pulls_by_repo(&pool, 1)
            .unwrap()
            .into_iter()
            .map(|pull| pull.number)
            .collect::<Vec<_>>();

        assert_eq!(written, 1);
        assert!(errors.is_empty());
        assert_eq!(numbers, vec![1]);
    }

    #[test]
    fn pull_report_is_partial_when_one_repo_succeeds_with_zero_items_and_another_has_many_upsert_failures(
    ) {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "CREATE TRIGGER fail_all_pulls BEFORE INSERT ON pulls
             BEGIN
                SELECT RAISE(FAIL, 'forced pull failure');
             END",
            [],
        )
        .unwrap();
        drop(conn);

        let ok_repo = WatchedRepo {
            id: 1,
            full_name: "octocat/empty".into(),
        };
        let failing_repo = WatchedRepo {
            id: 1,
            full_name: "octocat/hello".into(),
        };
        let mut errors = Vec::new();
        let written = record_pull_result(
            &pool,
            &ok_repo,
            Ok(vec![]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        ) + record_pull_result(
            &pool,
            &failing_repo,
            Ok(vec![sample_pr(1, "first"), sample_pr(2, "second")]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        );

        let report = pull_report(2, written, errors);

        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.errors.len(), 1);
        assert!(report.errors[0].message.contains("2 pull upsert(s) failed"));
    }

    #[test]
    fn pull_report_is_partial_when_one_repo_has_upsert_and_delete_failures() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (2, 1, 'octocat/failing', 1)",
            [],
        )
        .unwrap();
        drop(conn);
        upsert_pull(&pool, 2, &sample_pr(99, "stale"), "t0").unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "CREATE TRIGGER fail_all_pull_inserts BEFORE INSERT ON pulls
             BEGIN
                SELECT RAISE(FAIL, 'forced pull insert failure');
             END",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TRIGGER fail_all_pull_deletes BEFORE DELETE ON pulls
             BEGIN
                SELECT RAISE(FAIL, 'forced pull delete failure');
             END",
            [],
        )
        .unwrap();
        drop(conn);

        let ok_repo = WatchedRepo {
            id: 1,
            full_name: "octocat/empty".into(),
        };
        let failing_repo = WatchedRepo {
            id: 2,
            full_name: "octocat/failing".into(),
        };
        let mut errors = Vec::new();
        let written = record_pull_result(
            &pool,
            &ok_repo,
            Ok(vec![]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        ) + record_pull_result(
            &pool,
            &failing_repo,
            Ok(vec![sample_pr(1, "first"), sample_pr(2, "second")]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        );

        let report = pull_report(2, written, errors);

        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "persist_pull_cache");
        assert!(report.errors[0].message.contains("2 pull upsert(s) failed"));
        assert!(report.errors[0].message.contains("delete error:"));
        assert!(report.errors[0]
            .message
            .contains("forced pull delete failure"));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn sync_pulls_reports_failed_for_invalid_repo_full_name() {
        let pool = test_pool();
        let client = GithubClient::new("token");
        let repos = vec![WatchedRepo {
            id: 1,
            full_name: "invalid".into(),
        }];

        let report = sync_pulls(&pool, &client, &repos, "2026-04-30T01:00:00Z").await;

        assert_eq!(report.scope, SyncScope::Pulls);
        assert_eq!(report.status, SyncStepStatus::Failed);
        assert_eq!(report.items_written, 0);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "parse_repo_full_name");
    }
}
