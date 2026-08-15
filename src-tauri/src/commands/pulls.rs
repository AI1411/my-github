use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::commands::sync::run_sync_for_scopes;
use crate::db::SqlitePool;
use crate::github::rest::{
    convert_pull_to_draft, create_pull_request_review, get_check_runs, get_pull_request,
    get_pull_request_files, list_pull_request_reviews, mark_pull_ready_for_review,
    merge_pull_request, remove_pull_reviewers, request_pull_reviewers, review_state_for_event,
    update_issue,
};
use crate::github::types::{CheckRun, PullRequest, PullRequestFile, Review};
use crate::sync::types::{SyncReport, SyncScope, SyncStepStatus};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PullFilter {
    /// "created" | "assigned" | "review" | "mentioned" | "all"
    pub tab: Option<String>,
    /// "open" | "closed" | null
    pub state: Option<String>,
    pub repo_full_name: Option<String>,
    pub author_login: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullSummary {
    pub id: i64,
    pub number: i64,
    pub title: String,
    pub repo: String,
    pub author: Option<String>,
    pub state: String,
    pub is_draft: bool,
    pub head_ref: String,
    pub base_ref: String,
    pub updated_at: String,
    pub html_url: Option<String>,
    pub ci_state: Option<String>,
    pub review_state: Option<String>,
    pub has_mention: bool,
    pub requested_reviewers: Vec<ReviewerInfo>,
    pub merged_at: Option<String>,
    pub additions: Option<i64>,
    pub deletions: Option<i64>,
    pub changed_files: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewerInfo {
    pub login: String,
    pub avatar_url: String,
}

fn read_cached_pulls(pool: &SqlitePool, filter: &PullFilter) -> Result<Vec<PullSummary>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT p.number, p.title, p.state, p.is_draft, p.author_login,
                p.head_ref, p.base_ref, p.ci_state, p.review_state, p.has_mention,
                p.raw_json, p.updated_at, r.full_name
         FROM pulls p
         JOIN repos r ON r.id = p.repo_id
         WHERE 1=1",
    );
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(state) = &filter.state {
        sql.push_str(" AND p.state = ?");
        args.push(Box::new(state.clone()));
    }
    if let Some(repo) = &filter.repo_full_name {
        sql.push_str(" AND r.full_name = ?");
        args.push(Box::new(repo.clone()));
    }
    if let Some(author) = &filter.author_login {
        sql.push_str(" AND p.author_login = ?");
        args.push(Box::new(author.clone()));
    }
    sql.push_str(" ORDER BY p.updated_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params = rusqlite::params_from_iter(args.iter().map(|b| b.as_ref()));
    let rows = stmt
        .query_map(params, |row| {
            let raw: String = row.get(10)?;
            Ok(CachedRow {
                number: row.get(0)?,
                title: row.get(1)?,
                state: row.get(2)?,
                is_draft: row.get::<_, i64>(3)? != 0,
                author_login: row.get(4)?,
                head_ref: row.get(5)?,
                base_ref: row.get(6)?,
                ci_state: row.get(7)?,
                review_state: row.get(8)?,
                has_mention: row.get::<_, i64>(9)? != 0,
                raw_json: raw,
                updated_at: row.get(11)?,
                repo_full_name: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let r = r.map_err(|e| e.to_string())?;
        out.push(row_to_summary(r));
    }
    Ok(out)
}

struct CachedRow {
    number: i64,
    title: String,
    state: String,
    is_draft: bool,
    author_login: Option<String>,
    head_ref: String,
    base_ref: String,
    ci_state: Option<String>,
    review_state: Option<String>,
    has_mention: bool,
    raw_json: String,
    updated_at: String,
    repo_full_name: String,
}

fn row_to_summary(r: CachedRow) -> PullSummary {
    let parsed: Option<PullRequest> = serde_json::from_str(&r.raw_json).ok();
    let (html_url, merged_at, reviewers) = match parsed.as_ref() {
        Some(pr) => (
            Some(pr.html_url.clone()),
            pr.merged_at.clone(),
            pr.requested_reviewers
                .iter()
                .map(|u| ReviewerInfo {
                    login: u.login.clone(),
                    avatar_url: u.avatar_url.clone(),
                })
                .collect(),
        ),
        None => (None, None, Vec::new()),
    };
    PullSummary {
        id: r.number,
        number: r.number,
        title: r.title,
        repo: r.repo_full_name,
        author: r.author_login,
        state: r.state,
        is_draft: r.is_draft,
        head_ref: r.head_ref,
        base_ref: r.base_ref,
        updated_at: r.updated_at,
        html_url,
        ci_state: r.ci_state,
        review_state: r.review_state,
        has_mention: r.has_mention,
        requested_reviewers: reviewers,
        merged_at,
        additions: None,
        deletions: None,
        changed_files: None,
    }
}

/// List cached pulls immediately, then spawn a background task to refresh
/// from GitHub. Emits `pulls-updated` when fresh data is written to cache.
#[tauri::command]
pub async fn cmd_list_pulls<R: Runtime>(
    app: AppHandle<R>,
    filter: PullFilter,
) -> Result<Vec<PullSummary>, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let cached = read_cached_pulls(pool.inner(), &filter)?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = refresh_pulls(&handle).await {
            let _ = handle.emit("pulls-refresh-error", e.to_string());
        } else {
            let _ = handle.emit("pulls-updated", ());
        }
    });

    Ok(cached)
}

async fn refresh_pulls<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let report = run_sync_for_scopes(app, &[SyncScope::Repositories, SyncScope::Pulls]).await?;
    if let Some(err) = failed_step_error(&report, SyncScope::Pulls) {
        return Err(err);
    }
    Ok(())
}

fn failed_step_error(report: &SyncReport, scope: SyncScope) -> Option<String> {
    let step = report
        .steps
        .iter()
        .find(|step| step.scope == scope && step.status == SyncStepStatus::Failed)?;
    Some(match step.errors.first() {
        Some(error) => {
            let repo = error.repo.as_deref().unwrap_or("unknown repo");
            format!(
                "{} sync failed for {} during {}: {}",
                scope.as_str(),
                repo,
                error.operation,
                error.message
            )
        }
        None => format!("{} sync failed", scope.as_str()),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub sha: String,
    pub filename: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: Option<String>,
    pub blob_url: String,
    pub raw_url: String,
}

impl From<PullRequestFile> for FileDiff {
    fn from(f: PullRequestFile) -> Self {
        FileDiff {
            sha: f.sha,
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
            patch: f.patch,
            blob_url: f.blob_url,
            raw_url: f.raw_url,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlockingCheck {
    pub name: String,
    /// Conclusion for completed runs (`failure`, `timed_out`, …), or `pending` while in progress.
    pub conclusion: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeReadiness {
    pub mergeable: Option<bool>,
    pub mergeable_state: Option<String>,
    pub approvals: u32,
    pub changes_requested: u32,
    pub ci_state: Option<String>,
    pub is_draft: bool,
    pub ready: bool,
    /// Human-readable summary lines (kept for compact badge / tooltips).
    pub blockers: Vec<String>,
    /// Individual check runs that are blocking merge (failed or still running).
    pub blocking_checks: Vec<BlockingCheck>,
    /// Approvals still needed before merge (MVP: 1 when none yet, else 0).
    pub required_reviews_remaining: u32,
}

/// Reduces a chronological review list to each reviewer's latest meaningful
/// state (APPROVED / CHANGES_REQUESTED). COMMENTED / DISMISSED do not override
/// an earlier approval the way GitHub's own UI counts them; DISMISSED clears it.
fn summarize_reviews(reviews: &[Review]) -> (u32, u32) {
    use std::collections::HashMap;
    let mut latest: HashMap<&str, &str> = HashMap::new();
    for review in reviews {
        match review.state.as_str() {
            "APPROVED" | "CHANGES_REQUESTED" => {
                latest.insert(review.user.login.as_str(), review.state.as_str());
            }
            "DISMISSED" => {
                latest.remove(review.user.login.as_str());
            }
            _ => {}
        }
    }
    let approvals = latest.values().filter(|s| **s == "APPROVED").count() as u32;
    let changes_requested = latest
        .values()
        .filter(|s| **s == "CHANGES_REQUESTED")
        .count() as u32;
    (approvals, changes_requested)
}

/// Collapses check runs to a single CI state: failure > pending > success.
/// Returns None when there are no check runs.
fn summarize_check_runs(runs: &[CheckRun]) -> Option<String> {
    if runs.is_empty() {
        return None;
    }
    let any_failure = runs.iter().any(|r| {
        matches!(
            r.conclusion.as_deref(),
            Some("failure") | Some("timed_out") | Some("cancelled")
        )
    });
    if any_failure {
        return Some("failure".to_string());
    }
    let any_pending = runs.iter().any(|r| r.status != "completed");
    if any_pending {
        return Some("pending".to_string());
    }
    Some("success".to_string())
}

/// Collects check runs that block merge: non-success completed, or not yet completed.
fn collect_blocking_checks(runs: &[CheckRun]) -> Vec<BlockingCheck> {
    runs.iter()
        .filter_map(|r| {
            if r.status != "completed" {
                return Some(BlockingCheck {
                    name: r.name.clone(),
                    conclusion: "pending".to_string(),
                });
            }
            match r.conclusion.as_deref() {
                Some("success") | Some("neutral") | Some("skipped") => None,
                Some(conclusion) => Some(BlockingCheck {
                    name: r.name.clone(),
                    conclusion: conclusion.to_string(),
                }),
                None => Some(BlockingCheck {
                    name: r.name.clone(),
                    conclusion: "pending".to_string(),
                }),
            }
        })
        .collect()
}

fn compute_merge_readiness(
    pr: &PullRequest,
    reviews: &[Review],
    runs: &[CheckRun],
) -> MergeReadiness {
    let (approvals, changes_requested) = summarize_reviews(reviews);
    let ci_state = summarize_check_runs(runs);
    let blocking_checks = collect_blocking_checks(runs);
    let required_reviews_remaining = if approvals == 0 { 1 } else { 0 };
    let mut blockers: Vec<String> = Vec::new();

    if pr.draft {
        blockers.push("Draft".to_string());
    }
    if pr.mergeable == Some(false) || pr.mergeable_state.as_deref() == Some("dirty") {
        blockers.push("Merge conflicts".to_string());
    }
    match ci_state.as_deref() {
        Some("failure") => blockers.push("CI failing".to_string()),
        Some("pending") => blockers.push("CI running".to_string()),
        _ => {}
    }
    if changes_requested > 0 {
        blockers.push("Changes requested".to_string());
    }
    if approvals == 0 {
        blockers.push("No approvals yet".to_string());
    }
    if blockers.is_empty() && pr.mergeable_state.as_deref() == Some("blocked") {
        blockers.push("Blocked by branch protection".to_string());
    }
    if blockers.is_empty() && pr.mergeable_state.as_deref() == Some("behind") {
        blockers.push("Branch behind base".to_string());
    }

    MergeReadiness {
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state.clone(),
        approvals,
        changes_requested,
        ci_state,
        is_draft: pr.draft,
        ready: blockers.is_empty(),
        blockers,
        blocking_checks,
        required_reviews_remaining,
    }
}

#[tauri::command]
pub async fn cmd_get_merge_readiness(
    owner: String,
    repo: String,
    number: u32,
) -> Result<MergeReadiness, String> {
    let client = crate::github::client::client_for_active_account()?;
    let pr = get_pull_request(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let reviews = list_pull_request_reviews(&client, &owner, &repo, number)
        .await
        .unwrap_or_default();
    let runs = get_check_runs(&client, &owner, &repo, &pr.head.sha)
        .await
        .map(|resp| resp.check_runs)
        .unwrap_or_default();
    Ok(compute_merge_readiness(&pr, &reviews, &runs))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewContextReviewer {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewContextTeam {
    pub slug: String,
    pub name: String,
    pub combined_slug: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewContextReview {
    pub login: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewContext {
    pub requested_reviewers: Vec<ReviewContextReviewer>,
    pub requested_teams: Vec<ReviewContextTeam>,
    pub changed_files: Vec<String>,
    pub codeowners_text: Option<String>,
    pub codeowners_path: Option<String>,
    pub reviews: Vec<ReviewContextReview>,
}

const CODEOWNERS_CANDIDATES: &[&str] = &["CODEOWNERS", "docs/CODEOWNERS", ".github/CODEOWNERS"];

async fn load_codeowners(
    client: &crate::github::client::GithubClient,
    owner: &str,
    repo: &str,
    git_ref: &str,
) -> (Option<String>, Option<String>) {
    for path in CODEOWNERS_CANDIDATES {
        match crate::github::rest::get_file_contents(client, owner, repo, path, git_ref).await {
            Ok((_sha, text)) => return (Some(text), Some((*path).to_string())),
            Err(_) => continue,
        }
    }
    (None, None)
}

/// CODEOWNERS text + requested users/teams + reviews for PR detail context.
#[tauri::command]
pub async fn cmd_get_review_context(
    owner: String,
    repo: String,
    number: u32,
) -> Result<ReviewContext, String> {
    let client = crate::github::client::client_for_active_account()?;
    let pr = get_pull_request(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let files = get_pull_request_files(&client, &owner, &repo, number)
        .await
        .unwrap_or_default();
    let reviews = list_pull_request_reviews(&client, &owner, &repo, number)
        .await
        .unwrap_or_default();
    let (codeowners_text, codeowners_path) =
        load_codeowners(&client, &owner, &repo, &pr.base.ref_name).await;

    let requested_teams = pr
        .requested_teams
        .iter()
        .map(|t| {
            let org = t
                .organization
                .as_ref()
                .map(|o| o.login.as_str())
                .unwrap_or(owner.as_str());
            ReviewContextTeam {
                slug: t.slug.clone(),
                name: t.name.clone(),
                combined_slug: format!("{org}/{}", t.slug),
            }
        })
        .collect();

    Ok(ReviewContext {
        requested_reviewers: pr
            .requested_reviewers
            .into_iter()
            .map(|u| ReviewContextReviewer {
                login: u.login,
                avatar_url: u.avatar_url,
            })
            .collect(),
        requested_teams,
        changed_files: files.into_iter().map(|f| f.filename).collect(),
        codeowners_text,
        codeowners_path,
        reviews: reviews
            .into_iter()
            .map(|r| ReviewContextReview {
                login: r.user.login,
                state: r.state,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn cmd_get_pull_files(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<FileDiff>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let files = get_pull_request_files(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(files.into_iter().map(FileDiff::from).collect())
}

fn format_review_api_error(err: crate::github::client::ClientError) -> String {
    match err {
        crate::github::client::ClientError::Api { status: 403, .. } => {
            "Permission denied (403). You may not be able to review this pull request.".to_string()
        }
        crate::github::client::ClientError::Api { status: 422, message } => {
            format!("Review rejected (422): {message}")
        }
        other => other.to_string(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitReviewResult {
    pub event: String,
    pub review_state: Option<String>,
    pub html_url: Option<String>,
}

/// Submit an in-app PR review (`APPROVE` | `REQUEST_CHANGES` | `COMMENT`).
#[tauri::command]
pub async fn cmd_submit_pull_review<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    event: String,
    body: Option<String>,
) -> Result<SubmitReviewResult, String> {
    let event = event.trim().to_uppercase();
    if !matches!(event.as_str(), "APPROVE" | "REQUEST_CHANGES" | "COMMENT") {
        return Err("event must be APPROVE, REQUEST_CHANGES, or COMMENT".to_string());
    }
    if matches!(event.as_str(), "REQUEST_CHANGES" | "COMMENT")
        && body.as_ref().map(|b| b.trim().is_empty()).unwrap_or(true)
    {
        return Err("a review body is required for Request changes and Comment".to_string());
    }

    let client = crate::github::client::client_for_active_account()?;
    let review = create_pull_request_review(
        &client,
        &owner,
        &repo,
        number,
        &event,
        body.as_deref().map(str::trim).filter(|s| !s.is_empty()),
    )
    .await
    .map_err(format_review_api_error)?;

    let review_state = review_state_for_event(&event).map(str::to_string);
    if let Some(state) = review_state.as_deref() {
        if let Some(pool) = app.try_state::<SqlitePool>() {
            let full_name = format!("{owner}/{repo}");
            let _ = crate::cache::pulls::update_pull_review_state(
                pool.inner(),
                &full_name,
                number as i64,
                state,
            );
        }
        let _ = app.emit("pulls-updated", ());
    }

    Ok(SubmitReviewResult {
        event,
        review_state,
        html_url: Some(review.html_url),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCommentSummary {
    pub id: u64,
    pub user_login: String,
    pub body: String,
    pub path: String,
    pub html_url: String,
    pub created_at: String,
    pub in_reply_to_id: Option<u64>,
    pub has_suggestion: bool,
    pub line: Option<u64>,
}

#[tauri::command]
pub async fn cmd_list_pull_review_comments(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<ReviewCommentSummary>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let comments = crate::github::rest::list_pull_review_comments(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(comments
        .into_iter()
        .map(|c| ReviewCommentSummary {
            id: c.id,
            user_login: c.user.login,
            body: c.body.clone(),
            path: c.path,
            html_url: c.html_url,
            created_at: c.created_at,
            in_reply_to_id: c.in_reply_to_id,
            has_suggestion: crate::github::rest::extract_suggestion_block(&c.body).is_some(),
            line: c.line.or(c.original_line),
        })
        .collect())
}

#[tauri::command]
pub async fn cmd_reply_pull_review_comment(
    owner: String,
    repo: String,
    number: u32,
    comment_id: u64,
    body: String,
) -> Result<ReviewCommentSummary, String> {
    if body.trim().is_empty() {
        return Err("reply body is required".to_string());
    }
    let client = crate::github::client::client_for_active_account()?;
    let c = crate::github::rest::reply_pull_review_comment(
        &client,
        &owner,
        &repo,
        number,
        comment_id,
        body.trim(),
    )
    .await
    .map_err(format_mutation_api_error)?;
    Ok(ReviewCommentSummary {
        id: c.id,
        user_login: c.user.login,
        body: c.body.clone(),
        path: c.path,
        html_url: c.html_url,
        created_at: c.created_at,
        in_reply_to_id: c.in_reply_to_id,
        has_suggestion: crate::github::rest::extract_suggestion_block(&c.body).is_some(),
        line: c.line.or(c.original_line),
    })
}

fn apply_suggestion_to_content(content: &str, line: Option<u64>, suggestion: &str) -> String {
    let ends_with_newline = content.ends_with('\n');
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let suggestion_lines: Vec<String> = suggestion.lines().map(|l| l.to_string()).collect();
    if let Some(line) = line {
        let idx = (line as usize).saturating_sub(1);
        if idx < lines.len() {
            lines.splice(idx..=idx, suggestion_lines);
        } else {
            lines.extend(suggestion_lines);
        }
    } else {
        lines = suggestion_lines;
    }
    let mut out = lines.join("\n");
    if ends_with_newline {
        out.push('\n');
    }
    out
}

#[tauri::command]
pub async fn cmd_apply_pull_suggestion(
    owner: String,
    repo: String,
    number: u32,
    comment_id: u64,
) -> Result<(), String> {
    let client = crate::github::client::client_for_active_account()?;
    let comments = crate::github::rest::list_pull_review_comments(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let comment = comments
        .into_iter()
        .find(|c| c.id == comment_id)
        .ok_or_else(|| "review comment not found".to_string())?;
    let suggestion = crate::github::rest::extract_suggestion_block(&comment.body)
        .ok_or_else(|| "comment has no suggestion block".to_string())?;
    let pr = get_pull_request(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let branch = pr.head.ref_name.clone();
    let git_ref = comment
        .commit_id
        .clone()
        .unwrap_or_else(|| pr.head.sha.clone());
    let (sha, content) = crate::github::rest::get_file_contents(
        &client,
        &owner,
        &repo,
        &comment.path,
        &git_ref,
    )
    .await
    .map_err(format_mutation_api_error)?;
    let next = apply_suggestion_to_content(&content, comment.line.or(comment.original_line), &suggestion);
    crate::github::rest::update_file_contents(
        &client,
        &owner,
        &repo,
        &comment.path,
        &format!("Apply suggestion from review comment"),
        &next,
        &sha,
        &branch,
    )
    .await
    .map_err(format_mutation_api_error)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullCommitSummary {
    pub sha: String,
    pub message: String,
    pub author_login: Option<String>,
    pub author_name: Option<String>,
    pub committed_at: Option<String>,
    pub html_url: String,
}

#[tauri::command]
pub async fn cmd_list_pull_commits(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<PullCommitSummary>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let commits = crate::github::rest::list_pull_commits(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(commits
        .into_iter()
        .map(|c| PullCommitSummary {
            sha: c.sha,
            message: c.commit.message.lines().next().unwrap_or("").to_string(),
            author_login: c.author.map(|u| u.login),
            author_name: c.commit.author.as_ref().map(|a| a.name.clone()),
            committed_at: c
                .commit
                .author
                .as_ref()
                .and_then(|a| a.date.clone())
                .or_else(|| c.commit.committer.as_ref().and_then(|a| a.date.clone())),
            html_url: c.html_url,
        })
        .collect())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullCheckSummary {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub html_url: String,
}

#[tauri::command]
pub async fn cmd_list_pull_checks(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<PullCheckSummary>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let pr = get_pull_request(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let runs = get_check_runs(&client, &owner, &repo, &pr.head.sha)
        .await
        .map_err(|e| e.to_string())?;
    Ok(runs
        .check_runs
        .into_iter()
        .map(|r| PullCheckSummary {
            id: r.id,
            name: r.name,
            status: r.status,
            conclusion: r.conclusion,
            started_at: r.started_at,
            completed_at: r.completed_at,
            html_url: r.html_url,
        })
        .collect())
}

const FAILURE_EXCERPT_MAX_CHARS: usize = 8_192;
const FAILURE_EXCERPT_MAX_LINES: usize = 40;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckFailureAnnotation {
    pub path: String,
    pub start_line: Option<u32>,
    pub level: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckFailureExcerpt {
    pub check_run_id: u64,
    pub name: String,
    pub html_url: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub text_excerpt: Option<String>,
    pub truncated: bool,
    pub annotations: Vec<CheckFailureAnnotation>,
    pub note: Option<String>,
}

fn truncate_excerpt(raw: &str) -> (String, bool) {
    let mut truncated = false;
    let mut lines: Vec<&str> = raw.lines().collect();
    if lines.len() > FAILURE_EXCERPT_MAX_LINES {
        lines.truncate(FAILURE_EXCERPT_MAX_LINES);
        truncated = true;
    }
    let mut text = lines.join("\n");
    if text.len() > FAILURE_EXCERPT_MAX_CHARS {
        text = text.chars().take(FAILURE_EXCERPT_MAX_CHARS).collect();
        truncated = true;
    }
    (text, truncated)
}

#[tauri::command]
pub async fn cmd_get_check_failure_excerpt(
    owner: String,
    repo: String,
    check_run_id: u64,
) -> Result<CheckFailureExcerpt, String> {
    let client = crate::github::client::client_for_active_account()?;
    let run = crate::github::rest::get_check_run(&client, &owner, &repo, check_run_id)
        .await
        .map_err(|e| e.to_string())?;
    let annotations = crate::github::rest::list_check_run_annotations(
        &client, &owner, &repo, check_run_id,
    )
    .await
    .unwrap_or_default();

    let output = run.output.unwrap_or_default();
    let mut truncated = false;
    let text_excerpt = output.text.as_ref().map(|t| {
        let (excerpt, t) = truncate_excerpt(t);
        truncated |= t;
        excerpt
    });
    let summary = output.summary.as_ref().map(|s| {
        let (excerpt, t) = truncate_excerpt(s);
        truncated |= t;
        excerpt
    });

    let note = if annotations.is_empty() && text_excerpt.is_none() && summary.is_none() {
        Some("No in-app annotations or output text. Open GitHub for full logs.".to_string())
    } else if truncated {
        Some(format!(
            "Excerpt truncated to {FAILURE_EXCERPT_MAX_LINES} lines / {FAILURE_EXCERPT_MAX_CHARS} chars."
        ))
    } else {
        None
    };

    Ok(CheckFailureExcerpt {
        check_run_id: run.id,
        name: run.name,
        html_url: run.html_url,
        title: output.title,
        summary,
        text_excerpt,
        truncated,
        annotations: annotations
            .into_iter()
            .take(20)
            .map(|a| CheckFailureAnnotation {
                path: a.path,
                start_line: a.start_line,
                level: a.annotation_level,
                message: a.message.unwrap_or_default(),
            })
            .collect(),
        note,
    })
}

fn format_mutation_api_error(err: crate::github::client::ClientError) -> String {
    match err {
        crate::github::client::ClientError::Api { status: 403, .. } => {
            "Permission denied (403). You may lack write access.".to_string()
        }
        crate::github::client::ClientError::Api { status: 405, message } => {
            format!("Merge not allowed (405): {message}")
        }
        crate::github::client::ClientError::Api { status: 409, message } => {
            format!("Conflict (409): {message}")
        }
        crate::github::client::ClientError::Api { status: 422, message } => {
            format!("Rejected (422): {message}")
        }
        other => other.to_string(),
    }
}

#[tauri::command]
pub async fn cmd_merge_pull<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    merge_method: Option<String>,
) -> Result<(), String> {
    let method = merge_method.unwrap_or_else(|| "merge".to_string());
    if !matches!(method.as_str(), "merge" | "squash" | "rebase") {
        return Err("merge_method must be merge, squash, or rebase".to_string());
    }
    let client = crate::github::client::client_for_active_account()?;
    merge_pull_request(&client, &owner, &repo, number, &method)
        .await
        .map_err(format_mutation_api_error)?;
    let full_name = format!("{owner}/{repo}");
    if let Some(pool) = app.try_state::<SqlitePool>() {
        let _ = crate::cache::pulls::update_pull_state(pool.inner(), &full_name, number as i64, "closed");
    }
    let _ = app.emit("pulls-updated", ());
    Ok(())
}

#[tauri::command]
pub async fn cmd_set_pull_state<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    state: String,
) -> Result<(), String> {
    let state = state.to_lowercase();
    if !matches!(state.as_str(), "open" | "closed") {
        return Err("state must be open or closed".to_string());
    }
    let client = crate::github::client::client_for_active_account()?;
    update_issue(
        &client,
        &owner,
        &repo,
        number,
        Some(&state),
        None,
        None,
    )
    .await
    .map_err(format_mutation_api_error)?;
    let full_name = format!("{owner}/{repo}");
    if let Some(pool) = app.try_state::<SqlitePool>() {
        let _ = crate::cache::pulls::update_pull_state(pool.inner(), &full_name, number as i64, &state);
    }
    let _ = app.emit("pulls-updated", ());
    Ok(())
}

#[tauri::command]
pub async fn cmd_set_pull_draft<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    draft: bool,
) -> Result<(), String> {
    let client = crate::github::client::client_for_active_account()?;
    if draft {
        convert_pull_to_draft(&client, &owner, &repo, number)
            .await
            .map_err(format_mutation_api_error)?;
    } else {
        mark_pull_ready_for_review(&client, &owner, &repo, number)
            .await
            .map_err(format_mutation_api_error)?;
    }
    let full_name = format!("{owner}/{repo}");
    if let Some(pool) = app.try_state::<SqlitePool>() {
        let _ = crate::cache::pulls::update_pull_draft(pool.inner(), &full_name, number as i64, draft);
    }
    let _ = app.emit("pulls-updated", ());
    Ok(())
}

#[tauri::command]
pub async fn cmd_update_pull_reviewers<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    add: Option<Vec<String>>,
    remove: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    let client = crate::github::client::client_for_active_account()?;
    if let Some(reviewers) = add.as_ref().filter(|v| !v.is_empty()) {
        request_pull_reviewers(&client, &owner, &repo, number, reviewers)
            .await
            .map_err(format_mutation_api_error)?;
    }
    if let Some(reviewers) = remove.as_ref().filter(|v| !v.is_empty()) {
        remove_pull_reviewers(&client, &owner, &repo, number, reviewers)
            .await
            .map_err(format_mutation_api_error)?;
    }
    let pr = get_pull_request(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let logins: Vec<String> = pr
        .requested_reviewers
        .iter()
        .map(|u| u.login.clone())
        .collect();
    let _ = app.emit("pulls-updated", ());
    Ok(logins)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::pulls::upsert_pull;
    use crate::db::{init_pool, run_migrations};
    use crate::github::client::RateLimitInfo;
    use crate::github::types::{PrRef, PullRequest, User};
    use crate::sync::types::{SyncErrorSummary, SyncReport, SyncStepReport, SyncStepStatus};
    use std::path::Path;

    fn sample_pr(number: u32, title: &str, state: &str, draft: bool) -> PullRequest {
        PullRequest {
            id: number as u64,
            number,
            title: title.into(),
            state: state.into(),
            draft,
            html_url: format!("https://github.com/o/r/pull/{number}"),
            user: User {
                id: 1,
                login: "octocat".into(),
                avatar_url: "https://a".into(),
                html_url: "https://u".into(),
                name: None,
            },
            body: None,
            created_at: "2026-04-20T00:00:00Z".into(),
            updated_at: "2026-04-21T00:00:00Z".into(),
            merged_at: None,
            head: PrRef {
                label: "o:feat".into(),
                ref_name: "feat".into(),
                sha: "abc".into(),
                repo: None,
            },
            base: PrRef {
                label: "o:main".into(),
                ref_name: "main".into(),
                sha: "def".into(),
                repo: None,
            },
            requested_reviewers: vec![],
            requested_teams: vec![],
            mergeable: None,
            mergeable_state: None,
        }
    }

    fn seed_pool() -> SqlitePool {
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
             VALUES (1, 1, 'octocat/alpha', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO repos (id, account_id, full_name, is_watched)
             VALUES (2, 1, 'octocat/beta', 1)",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    #[test]
    fn read_cached_pulls_returns_all_without_filter() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 2, &sample_pr(2, "b", "open", true), "now").unwrap();

        let got = read_cached_pulls(&pool, &PullFilter::default()).unwrap();
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn read_cached_pulls_filters_by_state() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 1, &sample_pr(2, "b", "closed", false), "now").unwrap();

        let filter = PullFilter {
            state: Some("open".into()),
            ..Default::default()
        };
        let got = read_cached_pulls(&pool, &filter).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].state, "open");
    }

    #[test]
    fn read_cached_pulls_filters_by_repo() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(1, "a", "open", false), "now").unwrap();
        upsert_pull(&pool, 2, &sample_pr(2, "b", "open", false), "now").unwrap();

        let filter = PullFilter {
            repo_full_name: Some("octocat/alpha".into()),
            ..Default::default()
        };
        let got = read_cached_pulls(&pool, &filter).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].repo, "octocat/alpha");
    }

    #[test]
    fn read_cached_pulls_populates_html_url_from_raw_json() {
        let pool = seed_pool();
        upsert_pull(&pool, 1, &sample_pr(7, "seven", "open", false), "now").unwrap();
        let got = read_cached_pulls(&pool, &PullFilter::default()).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(
            got[0].html_url.as_deref(),
            Some("https://github.com/o/r/pull/7")
        );
    }

    #[test]
    fn file_diff_conversion_preserves_fields() {
        let f = PullRequestFile {
            sha: "a".into(),
            filename: "src/lib.rs".into(),
            status: "modified".into(),
            additions: 3,
            deletions: 1,
            changes: 4,
            blob_url: "https://b".into(),
            raw_url: "https://r".into(),
            patch: Some("@@".into()),
        };
        let d: FileDiff = f.into();
        assert_eq!(d.filename, "src/lib.rs");
        assert_eq!(d.additions, 3);
        assert_eq!(d.patch, Some("@@".to_string()));
    }

    #[test]
    fn pull_filter_default_has_empty_labels() {
        let f = PullFilter::default();
        assert!(f.labels.is_empty());
        assert!(f.state.is_none());
    }

    fn report_with_pull_step(status: SyncStepStatus) -> SyncReport {
        SyncReport {
            started_at_epoch: 1,
            finished_at_epoch: 2,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 3,
            }),
            steps: vec![SyncStepReport {
                scope: SyncScope::Pulls,
                status,
                repos_seen: 1,
                items_written: if status == SyncStepStatus::Partial {
                    1
                } else {
                    0
                },
                errors: vec![SyncErrorSummary {
                    repo: Some("octocat/alpha".to_string()),
                    operation: "list_pull_requests".to_string(),
                    message: "GitHub API error (HTTP 500): unavailable".to_string(),
                }],
            }],
        }
    }

    #[test]
    fn failed_step_error_returns_message_for_failed_pull_step() {
        let err = failed_step_error(
            &report_with_pull_step(SyncStepStatus::Failed),
            SyncScope::Pulls,
        )
        .unwrap();
        assert!(err.contains("octocat/alpha"));
        assert!(err.contains("list_pull_requests"));
        assert!(err.contains("unavailable"));
    }

    #[test]
    fn failed_step_error_ignores_partial_pull_step() {
        assert_eq!(
            failed_step_error(
                &report_with_pull_step(SyncStepStatus::Partial),
                SyncScope::Pulls
            ),
            None
        );
    }

    fn review(login: &str, state: &str) -> Review {
        Review {
            id: 1,
            user: User {
                id: 1,
                login: login.into(),
                avatar_url: "".into(),
                html_url: "".into(),
                name: None,
            },
            body: "".into(),
            state: state.into(),
            html_url: "".into(),
            submitted_at: None,
            commit_id: "abc".into(),
        }
    }

    fn check_run(status: &str, conclusion: Option<&str>) -> CheckRun {
        named_check_run("ci", status, conclusion)
    }

    fn named_check_run(name: &str, status: &str, conclusion: Option<&str>) -> CheckRun {
        CheckRun {
            id: 1,
            name: name.into(),
            status: status.into(),
            conclusion: conclusion.map(String::from),
            started_at: None,
            completed_at: None,
            html_url: "".into(),
            app: crate::github::types::CheckApp {
                id: 1,
                name: "Actions".into(),
            },
            output: None,
        }
    }

    #[test]
    fn summarize_reviews_counts_latest_state_per_reviewer() {
        let reviews = vec![
            review("alice", "CHANGES_REQUESTED"),
            review("alice", "APPROVED"),
            review("bob", "COMMENTED"),
            review("carol", "CHANGES_REQUESTED"),
        ];
        let (approvals, changes_requested) = summarize_reviews(&reviews);
        assert_eq!(approvals, 1);
        assert_eq!(changes_requested, 1);
    }

    #[test]
    fn summarize_reviews_dismissed_clears_previous_state() {
        let reviews = vec![review("alice", "APPROVED"), review("alice", "DISMISSED")];
        let (approvals, changes_requested) = summarize_reviews(&reviews);
        assert_eq!(approvals, 0);
        assert_eq!(changes_requested, 0);
    }

    #[test]
    fn summarize_check_runs_failure_wins_over_pending() {
        let runs = vec![
            check_run("completed", Some("failure")),
            check_run("in_progress", None),
        ];
        assert_eq!(summarize_check_runs(&runs).as_deref(), Some("failure"));
    }

    #[test]
    fn summarize_check_runs_pending_wins_over_success() {
        let runs = vec![
            check_run("completed", Some("success")),
            check_run("queued", None),
        ];
        assert_eq!(summarize_check_runs(&runs).as_deref(), Some("pending"));
    }

    #[test]
    fn summarize_check_runs_empty_is_none() {
        assert_eq!(summarize_check_runs(&[]), None);
    }

    #[test]
    fn compute_merge_readiness_ready_when_approved_and_green() {
        let mut pr = sample_pr(1, "Ready PR", "open", false);
        pr.mergeable = Some(true);
        pr.mergeable_state = Some("clean".into());
        let readiness = compute_merge_readiness(
            &pr,
            &[review("alice", "APPROVED")],
            &[check_run("completed", Some("success"))],
        );
        assert!(readiness.ready);
        assert!(readiness.blockers.is_empty());
        assert!(readiness.blocking_checks.is_empty());
        assert_eq!(readiness.required_reviews_remaining, 0);
        assert_eq!(readiness.approvals, 1);
    }

    #[test]
    fn compute_merge_readiness_collects_all_blockers() {
        let mut pr = sample_pr(1, "Blocked PR", "open", true);
        pr.mergeable = Some(false);
        pr.mergeable_state = Some("dirty".into());
        let readiness = compute_merge_readiness(
            &pr,
            &[review("alice", "CHANGES_REQUESTED")],
            &[check_run("completed", Some("failure"))],
        );
        assert!(!readiness.ready);
        assert_eq!(
            readiness.blockers,
            vec![
                "Draft",
                "Merge conflicts",
                "CI failing",
                "Changes requested",
                "No approvals yet"
            ]
        );
        assert_eq!(
            readiness.blocking_checks,
            vec![BlockingCheck {
                name: "ci".into(),
                conclusion: "failure".into(),
            }]
        );
        assert_eq!(readiness.required_reviews_remaining, 1);
    }

    #[test]
    fn compute_merge_readiness_lists_pending_and_failed_checks() {
        let mut pr = sample_pr(1, "CI PR", "open", false);
        pr.mergeable = Some(true);
        pr.mergeable_state = Some("clean".into());
        let readiness = compute_merge_readiness(
            &pr,
            &[review("alice", "APPROVED")],
            &[
                named_check_run("lint", "completed", Some("failure")),
                named_check_run("build", "in_progress", None),
                named_check_run("unit", "completed", Some("success")),
                named_check_run("e2e", "completed", Some("skipped")),
            ],
        );
        assert!(!readiness.ready);
        assert_eq!(
            readiness.blocking_checks,
            vec![
                BlockingCheck {
                    name: "lint".into(),
                    conclusion: "failure".into(),
                },
                BlockingCheck {
                    name: "build".into(),
                    conclusion: "pending".into(),
                },
            ]
        );
        assert_eq!(readiness.required_reviews_remaining, 0);
    }

    #[test]
    fn compute_merge_readiness_branch_protection_blocked() {
        let mut pr = sample_pr(1, "Protected PR", "open", false);
        pr.mergeable = Some(true);
        pr.mergeable_state = Some("blocked".into());
        let readiness = compute_merge_readiness(
            &pr,
            &[review("alice", "APPROVED")],
            &[check_run("completed", Some("success"))],
        );
        assert!(!readiness.ready);
        assert_eq!(readiness.blockers, vec!["Blocked by branch protection"]);
        assert!(readiness.blocking_checks.is_empty());
        assert_eq!(readiness.required_reviews_remaining, 0);
    }
}
