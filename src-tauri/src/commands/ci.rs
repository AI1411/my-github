use serde::Serialize;
use tauri::{AppHandle, Runtime};

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::github::client::GithubClient;
use crate::github::rest::list_workflow_runs as rest_list_workflow_runs;
use crate::github::types::WorkflowRun;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunSummary {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub head_branch: Option<String>,
    pub run_number: u32,
    pub run_started_at: Option<String>,
    pub updated_at: String,
    pub html_url: String,
    pub repo: String,
}

fn run_to_summary(run: &WorkflowRun, repo: &str) -> WorkflowRunSummary {
    WorkflowRunSummary {
        id: run.id,
        name: run.name.clone(),
        status: run.status.clone(),
        conclusion: run.conclusion.clone(),
        head_branch: run.head_branch.clone(),
        run_number: run.run_number,
        run_started_at: run.run_started_at.clone(),
        updated_at: run.updated_at.clone(),
        html_url: run.html_url.clone(),
        repo: repo.to_string(),
    }
}

#[tauri::command]
pub async fn cmd_get_workflow_runs<R: Runtime>(
    _app: AppHandle<R>,
    owner: String,
    repo: String,
    branch: Option<String>,
) -> Result<Vec<WorkflowRunSummary>, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let repo_full = format!("{}/{}", owner, repo);
    let runs = rest_list_workflow_runs(&client, &owner, &repo, branch.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    Ok(runs.iter().map(|r| run_to_summary(r, &repo_full)).collect())
}

#[tauri::command]
pub async fn cmd_open_run_logs<R: Runtime>(
    app: AppHandle<R>,
    html_url: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&html_url, None::<String>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::types::WorkflowRun;

    fn sample_run() -> WorkflowRun {
        WorkflowRun {
            id: 100,
            name: "CI".to_string(),
            status: "completed".to_string(),
            conclusion: Some("failure".to_string()),
            head_branch: Some("main".to_string()),
            run_number: 7,
            run_started_at: Some("2026-04-21T00:00:00Z".to_string()),
            updated_at: "2026-04-21T00:05:00Z".to_string(),
            html_url: "https://github.com/octocat/hello/actions/runs/100".to_string(),
            workflow_id: 10,
        }
    }

    #[test]
    fn run_to_summary_maps_all_fields() {
        let run = sample_run();
        let s = run_to_summary(&run, "octocat/hello");
        assert_eq!(s.id, 100);
        assert_eq!(s.name, "CI");
        assert_eq!(s.status, "completed");
        assert_eq!(s.conclusion, Some("failure".to_string()));
        assert_eq!(s.head_branch, Some("main".to_string()));
        assert_eq!(s.run_number, 7);
        assert_eq!(s.repo, "octocat/hello");
        assert_eq!(
            s.html_url,
            "https://github.com/octocat/hello/actions/runs/100"
        );
    }

    #[test]
    fn run_to_summary_handles_no_conclusion() {
        let mut run = sample_run();
        run.conclusion = None;
        run.status = "in_progress".to_string();
        let s = run_to_summary(&run, "o/r");
        assert_eq!(s.conclusion, None);
        assert_eq!(s.status, "in_progress");
    }
}
