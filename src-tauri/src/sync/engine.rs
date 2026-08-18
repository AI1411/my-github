use std::time::{SystemTime, UNIX_EPOCH};

use crate::auth::pat::PatUser;
use crate::db::SqlitePool;
use crate::github::client::{GithubClient, RateLimitInfo};
use crate::github::rest::get_rate_limit;
use crate::sync::issues::sync_issues;
use crate::sync::pulls::sync_pulls;
use crate::sync::repos::{sync_repositories, watched_repos};
use crate::sync::status::persist_sync_report;
use crate::sync::types::{SyncErrorSummary, SyncReport, SyncScope, SyncStepReport};

pub struct SyncEngine<'a> {
    pool: &'a SqlitePool,
    client: GithubClient,
    user: PatUser,
}

impl<'a> SyncEngine<'a> {
    pub fn new(
        pool: &'a SqlitePool,
        token: String,
        user: PatUser,
        api_base: Option<String>,
    ) -> Self {
        let client = match api_base {
            Some(base) if !base.is_empty() => GithubClient::with_base_url(token, base),
            _ => GithubClient::new(token),
        };
        Self {
            pool,
            client,
            user,
        }
    }

    pub async fn sync_now(&self, scopes: &[SyncScope]) -> Result<SyncReport, String> {
        let started_at_epoch = epoch_now();
        let now = format!("@{}", started_at_epoch);
        let mut steps = Vec::new();

        if scopes.contains(&SyncScope::Repositories) {
            steps.push(sync_repositories(self.pool, &self.client, &self.user, &now).await);
        }

        if scopes.contains(&SyncScope::Pulls) || scopes.contains(&SyncScope::Issues) {
            match watched_repos(self.pool) {
                Ok(repos) => {
                    if scopes.contains(&SyncScope::Pulls) {
                        steps.push(sync_pulls(self.pool, &self.client, &repos, &now).await);
                    }

                    if scopes.contains(&SyncScope::Issues) {
                        steps.push(sync_issues(self.pool, &self.client, &repos, &now).await);
                    }
                }
                Err(message) => steps.extend(watched_repos_error_steps(scopes, message)),
            }
        }

        let finished_at_epoch = epoch_now();
        let rate_limit = get_rate_limit(&self.client).await.ok();
        let report = build_report(started_at_epoch, finished_at_epoch, rate_limit, steps);
        persist_sync_report(self.pool, &report).map_err(|err| err.to_string())?;

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

pub fn watched_repos_error_steps(scopes: &[SyncScope], message: String) -> Vec<SyncStepReport> {
    [SyncScope::Pulls, SyncScope::Issues]
        .into_iter()
        .filter(|scope| scopes.contains(scope))
        .map(|scope| {
            SyncStepReport::from_errors(
                scope,
                0,
                0,
                vec![SyncErrorSummary {
                    repo: None,
                    operation: "watched_repos".to_string(),
                    message: message.clone(),
                }],
            )
        })
        .collect()
}

fn epoch_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use crate::github::client::RateLimitInfo;
    use crate::sync::engine::{build_report, watched_repos_error_steps};
    use crate::sync::types::{SyncScope, SyncStepReport, SyncStepStatus};

    #[test]
    fn build_report_preserves_step_order_and_status() {
        let steps = vec![
            SyncStepReport::skipped(SyncScope::Pulls, "no repositories"),
            SyncStepReport::success(SyncScope::Repositories, 2, 2),
        ];

        let report = build_report(
            10,
            20,
            Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
                limit: 5000,
            }),
            steps,
        );

        assert_eq!(report.started_at_epoch, 10);
        assert_eq!(report.finished_at_epoch, 20);
        assert_eq!(report.rate_limit.unwrap().remaining, 4999);
        assert_eq!(report.steps[0].scope, SyncScope::Pulls);
        assert_eq!(report.steps[0].status, SyncStepStatus::Skipped);
        assert_eq!(report.steps[1].scope, SyncScope::Repositories);
        assert_eq!(report.steps[1].status, SyncStepStatus::Success);
    }

    #[test]
    fn watched_repos_error_steps_marks_requested_pull_and_issue_scopes_failed() {
        let steps = watched_repos_error_steps(
            &[SyncScope::Issues, SyncScope::Pulls, SyncScope::Repositories],
            "database is locked".to_string(),
        );

        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].scope, SyncScope::Pulls);
        assert_eq!(steps[0].status, SyncStepStatus::Failed);
        assert_eq!(steps[0].repos_seen, 0);
        assert_eq!(steps[0].items_written, 0);
        assert_eq!(steps[0].errors[0].operation, "watched_repos");
        assert_eq!(steps[0].errors[0].message, "database is locked");
        assert_eq!(steps[1].scope, SyncScope::Issues);
        assert_eq!(steps[1].status, SyncStepStatus::Failed);
        assert_eq!(steps[1].errors[0].operation, "watched_repos");
    }
}
