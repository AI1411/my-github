use crate::cache::issues::upsert_issue;
use crate::cache::repos::WatchedRepo;
use crate::db::SqlitePool;
use crate::github::client::GithubClient;
use crate::github::rest::list_issues;
use crate::github::types::Issue;
use crate::sync::types::{SyncErrorSummary, SyncScope, SyncStepReport};

pub async fn sync_issues(
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
        let result = list_issues(client, owner, name, "open", &[])
            .await
            .map_err(|err| err.to_string());
        items_written += record_issue_result(pool, repo, result, now, &mut errors);
    }

    issue_report(repos.len(), items_written, errors)
}

pub fn record_issue_result(
    pool: &SqlitePool,
    repo: &WatchedRepo,
    result: Result<Vec<Issue>, String>,
    now: &str,
    errors: &mut Vec<SyncErrorSummary>,
) -> usize {
    let issues = match result {
        Ok(issues) => issues,
        Err(message) => {
            errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "list_issues".to_string(),
                message,
            });
            return 0;
        }
    };

    let mut written = 0usize;
    for issue in issues {
        match upsert_issue(pool, repo.id, &issue, now) {
            Ok(()) => written += 1,
            Err(err) => errors.push(SyncErrorSummary {
                repo: Some(repo.full_name.clone()),
                operation: "upsert_issue".to_string(),
                message: err.to_string(),
            }),
        }
    }
    written
}

pub fn issue_report(
    repos_seen: usize,
    items_written: usize,
    errors: Vec<SyncErrorSummary>,
) -> SyncStepReport {
    SyncStepReport::from_errors(SyncScope::Issues, repos_seen, items_written, errors)
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
    use crate::cache::issues::list_issues_by_repo;
    use crate::cache::repos::WatchedRepo;
    use crate::db::{init_pool, run_migrations, SqlitePool};
    use crate::github::client::GithubClient;
    use crate::github::types::{Issue, Label, User};
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

    fn sample_issue(number: u32, title: &str) -> Issue {
        Issue {
            id: number as u64 + 2000,
            number,
            title: title.into(),
            state: "open".into(),
            html_url: format!("https://github.com/octocat/hello/issues/{number}"),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: String::new(),
                html_url: String::new(),
                name: None,
            },
            body: None,
            labels: vec![Label {
                id: 1,
                name: "bug".into(),
                color: "ffffff".into(),
            }],
            assignees: vec![],
            milestone: None,
            comments: 0,
            author_association: None,
            created_at: "2026-04-29T00:00:00Z".into(),
            updated_at: "2026-04-30T00:00:00Z".into(),
            closed_at: None,
            pull_request: None,
        }
    }

    #[test]
    fn record_issue_result_reports_partial_and_writes_successful_items() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "CREATE TRIGGER fail_second_issue BEFORE INSERT ON issues
             WHEN NEW.number = 2 BEGIN
                SELECT RAISE(FAIL, 'forced issue failure');
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

        let written = record_issue_result(
            &pool,
            &repo,
            Ok(vec![sample_issue(1, "first"), sample_issue(2, "second")]),
            "2026-04-30T01:00:00Z",
            &mut errors,
        );
        let report = issue_report(1, written, errors);

        assert_eq!(report.status, SyncStepStatus::Partial);
        assert_eq!(report.items_written, 1);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "upsert_issue");
        assert_eq!(list_issues_by_repo(&pool, 1).unwrap().len(), 1);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn sync_issues_reports_failed_for_invalid_repo_full_name() {
        let pool = test_pool();
        let client = GithubClient::new("token");
        let repos = vec![WatchedRepo {
            id: 1,
            full_name: "invalid".into(),
        }];

        let report = sync_issues(&pool, &client, &repos, "2026-04-30T01:00:00Z").await;

        assert_eq!(report.scope, SyncScope::Issues);
        assert_eq!(report.status, SyncStepStatus::Failed);
        assert_eq!(report.items_written, 0);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0].operation, "parse_repo_full_name");
    }
}
