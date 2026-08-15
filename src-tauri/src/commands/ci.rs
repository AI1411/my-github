use serde::Serialize;
use tauri::{AppHandle, Runtime};

use crate::github::rest::{
    get_workflow_run_logs_url, list_workflow_runs as rest_list_workflow_runs,
};
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
    let client = crate::github::client::client_for_active_account()?;
    let repo_full = format!("{}/{}", owner, repo);
    let runs = rest_list_workflow_runs(&client, &owner, &repo, branch.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    Ok(runs.iter().map(|r| run_to_summary(r, &repo_full)).collect())
}

#[tauri::command]
pub async fn cmd_open_run_logs<R: Runtime>(
    app: AppHandle<R>,
    owner: Option<String>,
    repo: Option<String>,
    run_id: Option<u64>,
    html_url: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let logs_url = if let Some(url) = html_url {
        url
    } else {
        let owner = owner.ok_or_else(|| "owner is required".to_string())?;
        let repo = repo.ok_or_else(|| "repo is required".to_string())?;
        let run_id = run_id.ok_or_else(|| "run id is required".to_string())?;
        let client = crate::github::client::client_for_active_account()?;
        get_workflow_run_logs_url(&client, &owner, &repo, run_id)
            .await
            .map_err(|e| e.to_string())?
    };
    app.opener()
        .open_url(&logs_url, None::<String>)
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

    #[test]
    fn cmd_open_run_logs_exists() {
        let _ = cmd_open_run_logs::<tauri::Wry>;
    }
}
