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
        } else if items_written > 0 || repos_seen > errors.len() {
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

/// Returns true when any sync step recorded a GitHub 401 / expired PAT error.
pub fn is_auth_expired_message(message: &str) -> bool {
    message.contains("HTTP 401")
        || message.contains("invalid or expired PAT")
        || message.to_ascii_lowercase().contains("bad credentials")
}

impl SyncReport {
    pub fn has_auth_expired_error(&self) -> bool {
        self.steps
            .iter()
            .flat_map(|step| step.errors.iter())
            .any(|error| is_auth_expired_message(&error.message))
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_report_serializes_scope_status_and_errors() {
        let report = SyncReport {
            started_at_epoch: 10,
            finished_at_epoch: 20,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
                limit: 5000,
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
        assert!(json.contains("\"itemsWritten\":1"));
        assert!(json.contains("octocat/beta"));
    }

    #[test]
    fn empty_sync_status_is_not_running() {
        let status = SyncStatus::empty();
        assert!(!status.is_running);
        assert!(status.last_report.is_none());
        assert!(status.last_finished_at_epoch.is_none());
    }

    #[test]
    fn from_errors_reports_partial_when_successful_repo_had_zero_writes() {
        let report = SyncStepReport::from_errors(
            SyncScope::Pulls,
            2,
            0,
            vec![SyncErrorSummary {
                repo: Some("octocat/beta".to_string()),
                operation: "list_pull_requests".to_string(),
                message: "GitHub API error (HTTP 500): unavailable".to_string(),
            }],
        );

        assert_eq!(report.status, SyncStepStatus::Partial);
    }

    #[test]
    fn from_errors_reports_failed_when_all_repos_failed_with_zero_writes() {
        let report = SyncStepReport::from_errors(
            SyncScope::Pulls,
            2,
            0,
            vec![
                SyncErrorSummary {
                    repo: Some("octocat/alpha".to_string()),
                    operation: "list_pull_requests".to_string(),
                    message: "GitHub API error (HTTP 500): unavailable".to_string(),
                },
                SyncErrorSummary {
                    repo: Some("octocat/beta".to_string()),
                    operation: "list_pull_requests".to_string(),
                    message: "GitHub API error (HTTP 500): unavailable".to_string(),
                },
            ],
        );

        assert_eq!(report.status, SyncStepStatus::Failed);
    }
}
