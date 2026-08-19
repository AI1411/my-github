use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::cache::issues::upsert_issue;
use crate::commands::limits::validate_label_list;
use crate::commands::sync::run_sync_for_scopes;
use crate::db::SqlitePool;
use crate::github::types::{Issue, IssueComment};
use crate::sync::types::{SyncReport, SyncScope, SyncStepStatus};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct IssueFilter {
    /// "open" | "closed" | null
    pub state: Option<String>,
    pub repo_full_name: Option<String>,
    pub assignee_login: Option<String>,
    pub milestone_title: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssigneeInfo {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelInfo {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentSummary {
    pub id: u64,
    pub author: AssigneeInfo,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub author_association: Option<String>,
}

fn comment_to_summary(c: &IssueComment) -> CommentSummary {
    CommentSummary {
        id: c.id,
        author: AssigneeInfo {
            login: c.user.login.clone(),
            avatar_url: c.user.avatar_url.clone(),
        },
        body: c.body.clone(),
        created_at: c.created_at.clone(),
        updated_at: c.updated_at.clone(),
        html_url: c.html_url.clone(),
        author_association: c.author_association.clone(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionInfo {
    pub content: String,
    pub count: u32,
    pub viewer_has_reacted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleReactionResult {
    pub content: String,
    pub reacted: bool,
    pub reactions: Vec<ReactionInfo>,
}

fn reaction_infos_from_counts(
    counts: Option<&crate::github::types::ReactionCounts>,
) -> Vec<ReactionInfo> {
    let counts = counts.cloned().unwrap_or_default();
    crate::github::rest::REACTION_CONTENTS
        .iter()
        .map(|content| ReactionInfo {
            content: (*content).to_string(),
            count: counts.count_for(content),
            viewer_has_reacted: false,
        })
        .collect()
}

fn build_reaction_infos(
    reactions: &[crate::github::types::Reaction],
    viewer_login: &str,
) -> Vec<ReactionInfo> {
    crate::github::rest::REACTION_CONTENTS
        .iter()
        .map(|content| {
            let matching: Vec<_> = reactions.iter().filter(|r| r.content == *content).collect();
            ReactionInfo {
                content: (*content).to_string(),
                count: matching.len() as u32,
                viewer_has_reacted: matching.iter().any(|r| r.user.login == viewer_login),
            }
        })
        .collect()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueSummary {
    pub id: i64,
    pub number: i64,
    pub title: String,
    pub repo: String,
    pub author: Option<String>,
    pub state: String,
    pub labels: Vec<LabelInfo>,
    pub assignees: Vec<AssigneeInfo>,
    pub milestone: Option<String>,
    pub comments: u32,
    pub updated_at: String,
    pub html_url: Option<String>,
    pub body: Option<String>,
    #[serde(default)]
    pub reactions: Vec<ReactionInfo>,
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("@{}", secs)
}

fn read_cached_issues(
    pool: &SqlitePool,
    filter: &IssueFilter,
) -> Result<Vec<IssueSummary>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT i.number, i.title, i.state, i.author_login, i.raw_json,
                i.updated_at, r.full_name
         FROM issues i
         JOIN repos r ON r.id = i.repo_id
         WHERE 1=1",
    );
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(state) = &filter.state {
        sql.push_str(" AND i.state = ?");
        args.push(Box::new(state.clone()));
    }
    if let Some(repo) = &filter.repo_full_name {
        sql.push_str(" AND r.full_name = ?");
        args.push(Box::new(repo.clone()));
    }
    sql.push_str(" ORDER BY i.updated_at DESC LIMIT 200");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params = rusqlite::params_from_iter(args.iter().map(|b| b.as_ref()));
    let rows = stmt
        .query_map(params, |row| {
            let raw: String = row.get(4)?;
            Ok(CachedRow {
                number: row.get(0)?,
                title: row.get(1)?,
                state: row.get(2)?,
                author_login: row.get(3)?,
                raw_json: raw,
                updated_at: row.get(5)?,
                repo_full_name: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        let r = r.map_err(|e| e.to_string())?;
        let summary = row_to_summary(r);
        if !filter.labels.is_empty() {
            let names: std::collections::HashSet<&str> =
                summary.labels.iter().map(|l| l.name.as_str()).collect();
            if !filter.labels.iter().all(|l| names.contains(l.as_str())) {
                continue;
            }
        }
        if let Some(a) = &filter.assignee_login {
            if !summary.assignees.iter().any(|x| x.login == *a) {
                continue;
            }
        }
        if let Some(m) = &filter.milestone_title {
            if summary.milestone.as_deref() != Some(m.as_str()) {
                continue;
            }
        }
        out.push(summary);
    }
    Ok(out)
}

struct CachedRow {
    number: i64,
    title: String,
    state: String,
    author_login: Option<String>,
    raw_json: String,
    updated_at: String,
    repo_full_name: String,
}

fn issue_fields_from_raw_json(
    raw: &str,
) -> (
    Option<String>,
    Option<String>,
    Vec<LabelInfo>,
    Vec<AssigneeInfo>,
    Option<String>,
    u32,
    Vec<ReactionInfo>,
) {
    let value: serde_json::Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => {
            return (
                None,
                None,
                Vec::new(),
                Vec::new(),
                None,
                0,
                reaction_infos_from_counts(None),
            );
        }
    };
    let html_url = value
        .get("html_url")
        .and_then(|v| v.as_str())
        .map(String::from);
    let body = value
        .get("body")
        .and_then(|v| v.as_str())
        .map(String::from);
    let labels = value
        .get("labels")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|l| {
                    let name = l.get("name").and_then(|n| n.as_str())?;
                    let color = l
                        .get("color")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string();
                    Some(LabelInfo {
                        name: name.to_string(),
                        color,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let assignees = value
        .get("assignees")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|u| {
                    let login = u.get("login").and_then(|l| l.as_str())?;
                    let avatar_url = u
                        .get("avatar_url")
                        .and_then(|a| a.as_str())
                        .unwrap_or("")
                        .to_string();
                    Some(AssigneeInfo {
                        login: login.to_string(),
                        avatar_url,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let milestone = value
        .get("milestone")
        .and_then(|m| m.get("title"))
        .and_then(|t| t.as_str())
        .map(String::from);
    let comments = value
        .get("comments")
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as u32;
    let reactions = value
        .get("reactions")
        .and_then(|r| serde_json::from_value(r.clone()).ok())
        .map(|counts: crate::github::types::ReactionCounts| {
            reaction_infos_from_counts(Some(&counts))
        })
        .unwrap_or_else(|| reaction_infos_from_counts(None));
    (html_url, body, labels, assignees, milestone, comments, reactions)
}

fn row_to_summary(r: CachedRow) -> IssueSummary {
    let (html_url, body, labels, assignees, milestone, comments, reactions) =
        issue_fields_from_raw_json(&r.raw_json);
    IssueSummary {
        id: r.number,
        number: r.number,
        title: r.title,
        repo: r.repo_full_name,
        author: r.author_login,
        state: r.state,
        labels,
        assignees,
        milestone,
        comments,
        updated_at: r.updated_at,
        html_url,
        body,
        reactions,
    }
}

fn issue_to_summary(issue: &Issue, repo_full_name: &str) -> IssueSummary {
    IssueSummary {
        id: issue.number as i64,
        number: issue.number as i64,
        title: issue.title.clone(),
        repo: repo_full_name.to_string(),
        author: Some(issue.user.login.clone()),
        state: issue.state.clone(),
        labels: issue
            .labels
            .iter()
            .map(|l| LabelInfo {
                name: l.name.clone(),
                color: l.color.clone(),
            })
            .collect(),
        assignees: issue
            .assignees
            .iter()
            .map(|u| AssigneeInfo {
                login: u.login.clone(),
                avatar_url: u.avatar_url.clone(),
            })
            .collect(),
        milestone: issue.milestone.as_ref().map(|m| m.title.clone()),
        comments: issue.comments,
        updated_at: issue.updated_at.clone(),
        html_url: Some(issue.html_url.clone()),
        body: issue.body.clone(),
        reactions: reaction_infos_from_counts(issue.reactions.as_ref()),
    }
}

/// List cached issues immediately, then spawn a background refresh task.
/// Emits `issues-updated` after a successful refresh.
#[tauri::command]
pub async fn cmd_list_issues<R: Runtime>(
    app: AppHandle<R>,
    filter: IssueFilter,
) -> Result<Vec<IssueSummary>, String> {
    validate_label_list(&filter.labels, "issue filter")?;
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let cached = read_cached_issues(pool.inner(), &filter)?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = refresh_issues(&handle).await {
            let _ = handle.emit("issues-refresh-error", e.to_string());
        } else {
            let _ = handle.emit("issues-updated", ());
        }
    });

    Ok(cached)
}

/// Fetch a single issue from GitHub. Updates cache opportunistically.
#[tauri::command]
pub async fn cmd_get_issue<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
) -> Result<IssueSummary, String> {
    let account_id = crate::auth::token_store::load_last_account_id()
        .ok_or_else(|| "no signed-in account".to_string())?;
    let client = crate::github::client::client_for_active_account()?;
    let issue = crate::github::rest::get_issue(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    let full_name = format!("{}/{}", owner, repo);

    if let Some(pool) = app.try_state::<SqlitePool>() {
        let conn = pool.inner().get().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM repos WHERE full_name = ?1")
            .map_err(|e| e.to_string())?;
        let repo_id: Option<i64> = stmt
            .query_row(rusqlite::params![full_name], |row| row.get(0))
            .ok();
        drop(stmt);
        drop(conn);
        if let Some(rid) = repo_id {
            let _ = upsert_issue(pool.inner(), rid, &issue, &now_iso());
        }
    }

    let mut summary = issue_to_summary(&issue, &full_name);
    if let Ok(reactions) =
        crate::github::rest::list_issue_reactions(&client, &owner, &repo, number).await
    {
        summary.reactions = build_reaction_infos(&reactions, &account_id);
    }
    Ok(summary)
}

/// Fetch all comments on an issue.
#[tauri::command]
pub async fn cmd_list_issue_comments(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<CommentSummary>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let comments = crate::github::rest::list_issue_comments(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(comments.iter().map(comment_to_summary).collect())
}

const TIMELINE_EVENTS: &[&str] = &[
    "labeled",
    "unlabeled",
    "assigned",
    "unassigned",
    "milestoned",
    "demilestoned",
    "cross-referenced",
    "commented",
    "closed",
    "reopened",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEventSummary {
    pub id: Option<u64>,
    pub event: String,
    pub created_at: String,
    pub actor_login: Option<String>,
    pub label_name: Option<String>,
    pub label_color: Option<String>,
    pub assignee_login: Option<String>,
    pub milestone_title: Option<String>,
    pub cross_ref_title: Option<String>,
    pub cross_ref_number: Option<u32>,
    pub cross_ref_url: Option<String>,
    pub body: Option<String>,
}

fn timeline_to_summary(ev: &crate::github::types::TimelineEvent) -> Option<TimelineEventSummary> {
    let event = ev.event.as_deref()?;
    if !TIMELINE_EVENTS.contains(&event) {
        return None;
    }
    let created_at = ev.created_at.clone().unwrap_or_default();
    let actor_login = ev
        .actor
        .as_ref()
        .or(ev.user.as_ref())
        .map(|u| u.login.clone());
    let (cross_ref_title, cross_ref_number, cross_ref_url) = ev
        .source
        .as_ref()
        .and_then(|s| s.issue.as_ref())
        .map(|issue| {
            (
                Some(issue.title.clone()),
                Some(issue.number),
                Some(issue.html_url.clone()),
            )
        })
        .unwrap_or((None, None, None));
    Some(TimelineEventSummary {
        id: ev.id,
        event: event.to_string(),
        created_at,
        actor_login,
        label_name: ev.label.as_ref().map(|l| l.name.clone()),
        label_color: ev.label.as_ref().map(|l| l.color.clone()),
        assignee_login: ev.assignee.as_ref().map(|u| u.login.clone()),
        milestone_title: ev.milestone.as_ref().map(|m| m.title.clone()),
        cross_ref_title,
        cross_ref_number,
        cross_ref_url,
        body: ev.body.clone(),
    })
}

/// Fetch issue timeline events (labels, assigns, milestones, cross-refs, etc.).
#[tauri::command]
pub async fn cmd_list_issue_timeline(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<TimelineEventSummary>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let events = crate::github::rest::list_issue_timeline(&client, &owner, &repo, number)
        .await
        .map_err(|e| e.to_string())?;
    Ok(events.iter().filter_map(timeline_to_summary).collect())
}

/// Toggle a reaction on an issue body or an issue comment.
/// When `comment_id` is set, targets `/issues/comments/{id}/reactions`.
#[tauri::command]
pub async fn cmd_toggle_issue_reaction(
    owner: String,
    repo: String,
    number: u32,
    content: String,
    comment_id: Option<u64>,
) -> Result<ToggleReactionResult, String> {
    if !crate::github::rest::is_valid_reaction_content(&content) {
        return Err(format!("invalid reaction content: {content}"));
    }
    let account_id = crate::auth::token_store::load_last_account_id()
        .ok_or_else(|| "no signed-in account".to_string())?;
    let client = crate::github::client::client_for_active_account()?;

    let existing = if let Some(cid) = comment_id {
        crate::github::rest::list_issue_comment_reactions_by_content(
            &client, &owner, &repo, cid, &content,
        )
        .await
    } else {
        crate::github::rest::list_issue_reactions_by_content(
            &client, &owner, &repo, number, &content,
        )
        .await
    }
    .map_err(format_issue_mutation_error)?;

    let mine = existing.iter().find(|r| r.user.login == account_id);
    let reacted = if let Some(reaction) = mine {
        if let Some(cid) = comment_id {
            crate::github::rest::delete_issue_comment_reaction(
                &client, &owner, &repo, cid, reaction.id,
            )
            .await
        } else {
            crate::github::rest::delete_issue_reaction(
                &client, &owner, &repo, number, reaction.id,
            )
            .await
        }
        .map_err(format_issue_mutation_error)?;
        false
    } else {
        if let Some(cid) = comment_id {
            crate::github::rest::create_issue_comment_reaction(
                &client, &owner, &repo, cid, &content,
            )
            .await
        } else {
            crate::github::rest::create_issue_reaction(&client, &owner, &repo, number, &content)
                .await
        }
        .map_err(format_issue_mutation_error)?;
        true
    };

    let all = if let Some(cid) = comment_id {
        crate::github::rest::list_issue_comment_reactions(&client, &owner, &repo, cid).await
    } else {
        crate::github::rest::list_issue_reactions(&client, &owner, &repo, number).await
    }
    .map_err(|e| e.to_string())?;

    Ok(ToggleReactionResult {
        content,
        reacted,
        reactions: build_reaction_infos(&all, &account_id),
    })
}

fn format_issue_mutation_error(err: crate::github::client::ClientError) -> String {
    match err {
        crate::github::client::ClientError::Api { status: 403, .. } => {
            "Permission denied (403). You may lack write access.".to_string()
        }
        crate::github::client::ClientError::Api { status: 422, message } => {
            format!("Rejected (422): {message}")
        }
        other => other.to_string(),
    }
}

/// Update issue/PR metadata via issues API: state, labels, and/or assignees.
#[tauri::command]
pub async fn cmd_update_issue<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    number: u32,
    state: Option<String>,
    labels: Option<Vec<String>>,
    assignees: Option<Vec<String>>,
) -> Result<IssueSummary, String> {
    if state.is_none() && labels.is_none() && assignees.is_none() {
        return Err("at least one of state, labels, assignees is required".to_string());
    }
    let client = crate::github::client::client_for_active_account()?;
    let state_owned = state.map(|s| s.to_lowercase());
    if let Some(ref s) = state_owned {
        if !matches!(s.as_str(), "open" | "closed") {
            return Err("state must be open or closed".to_string());
        }
    }
    let updated = crate::github::rest::update_issue(
        &client,
        &owner,
        &repo,
        number,
        state_owned.as_deref(),
        labels.as_deref(),
        assignees.as_deref(),
    )
    .await
    .map_err(format_issue_mutation_error)?;

    let full_name = format!("{owner}/{repo}");
    let labels_json = serde_json::to_string(
        &updated
            .labels
            .iter()
            .map(|l| l.name.as_str())
            .collect::<Vec<_>>(),
    )
    .ok();
    let assignees_json = serde_json::to_string(
        &updated
            .assignees
            .iter()
            .map(|u| u.login.as_str())
            .collect::<Vec<_>>(),
    )
    .ok();
    if let Some(pool) = app.try_state::<SqlitePool>() {
        let _ = crate::cache::issues::update_issue_fields(
            pool.inner(),
            &full_name,
            number as i64,
            state_owned.as_deref(),
            labels_json.as_deref(),
            assignees_json.as_deref(),
        );
        let conn = pool.inner().get().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM repos WHERE full_name = ?1")
            .map_err(|e| e.to_string())?;
        let repo_id: Option<i64> = stmt
            .query_row(rusqlite::params![full_name], |row| row.get(0))
            .ok();
        drop(stmt);
        drop(conn);
        if let Some(rid) = repo_id {
            let _ = upsert_issue(pool.inner(), rid, &updated, &now_iso());
        }
    }
    let _ = app.emit("issues-updated", ());
    Ok(issue_to_summary(&updated, &full_name))
}

async fn refresh_issues<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let report = run_sync_for_scopes(app, &[SyncScope::Repositories, SyncScope::Issues]).await?;
    if let Some(err) = failed_step_error(&report, SyncScope::Issues) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::issues::upsert_issue;
    use crate::db::{init_pool, run_migrations};
    use crate::github::client::RateLimitInfo;
    use crate::github::types::{Issue, Label, Milestone, User};
    use crate::sync::types::{SyncErrorSummary, SyncReport, SyncStepReport, SyncStepStatus};
    use std::path::Path;

    fn user(login: &str) -> User {
        User {
            id: 1,
            login: login.into(),
            avatar_url: format!("https://a/{login}"),
            html_url: format!("https://u/{login}"),
            name: None,
        }
    }

    fn sample_issue(
        number: u32,
        state: &str,
        labels: Vec<&str>,
        assignees: Vec<&str>,
        milestone: Option<&str>,
        updated_at: &str,
    ) -> Issue {
        Issue {
            id: number as u64,
            number,
            title: format!("issue {number}"),
            state: state.into(),
            html_url: format!("https://github.com/o/r/issues/{number}"),
            user: user("octocat"),
            body: None,
            labels: labels
                .into_iter()
                .enumerate()
                .map(|(i, n)| Label {
                    id: i as u64,
                    name: n.into(),
                    color: "ff0000".into(),
                })
                .collect(),
            assignees: assignees.into_iter().map(user).collect(),
            milestone: milestone.map(|t| Milestone {
                id: 1,
                number: 1,
                title: t.into(),
                state: "open".into(),
                open_issues: 0,
                closed_issues: 0,
                due_on: None,
            }),
            comments: 0,
            author_association: Some("OWNER".into()),
            created_at: "2026-04-20T00:00:00Z".into(),
            updated_at: updated_at.into(),
            closed_at: None,
            pull_request: None,
            reactions: None,
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
    fn read_cached_issues_returns_all_without_filter() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            2,
            &sample_issue(2, "open", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        let got = read_cached_issues(&pool, &IssueFilter::default()).unwrap();
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn read_cached_issues_filters_by_state() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            1,
            &sample_issue(2, "closed", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        let f = IssueFilter {
            state: Some("open".into()),
            ..Default::default()
        };
        let got = read_cached_issues(&pool, &f).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].state, "open");
    }

    #[test]
    fn read_cached_issues_filters_by_repo() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            2,
            &sample_issue(2, "open", vec![], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        let f = IssueFilter {
            repo_full_name: Some("octocat/alpha".into()),
            ..Default::default()
        };
        let got = read_cached_issues(&pool, &f).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].repo, "octocat/alpha");
    }

    #[test]
    fn read_cached_issues_filters_by_labels_all_must_match() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec!["bug"], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            1,
            &sample_issue(2, "open", vec!["bug", "p0"], vec![], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        let f = IssueFilter {
            labels: vec!["bug".into(), "p0".into()],
            ..Default::default()
        };
        let got = read_cached_issues(&pool, &f).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].number, 2);
    }

    #[test]
    fn read_cached_issues_filters_by_assignee() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec![], vec!["alice"], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            1,
            &sample_issue(2, "open", vec![], vec!["bob"], None, "2026-04-21"),
            "now",
        )
        .unwrap();
        let f = IssueFilter {
            assignee_login: Some("bob".into()),
            ..Default::default()
        };
        let got = read_cached_issues(&pool, &f).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].number, 2);
    }

    #[test]
    fn read_cached_issues_filters_by_milestone() {
        let pool = seed_pool();
        upsert_issue(
            &pool,
            1,
            &sample_issue(1, "open", vec![], vec![], Some("v0.1"), "2026-04-21"),
            "now",
        )
        .unwrap();
        upsert_issue(
            &pool,
            1,
            &sample_issue(2, "open", vec![], vec![], Some("v0.2"), "2026-04-21"),
            "now",
        )
        .unwrap();
        let f = IssueFilter {
            milestone_title: Some("v0.2".into()),
            ..Default::default()
        };
        let got = read_cached_issues(&pool, &f).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].milestone.as_deref(), Some("v0.2"));
    }

    #[test]
    fn issue_filter_default_has_empty_labels() {
        let f = IssueFilter::default();
        assert!(f.labels.is_empty());
        assert!(f.state.is_none());
    }

    #[test]
    fn timeline_to_summary_maps_labeled_event() {
        let ev = crate::github::types::TimelineEvent {
            id: Some(1),
            event: Some("labeled".into()),
            created_at: Some("2026-04-20T00:00:00Z".into()),
            actor: Some(user("octocat")),
            label: Some(Label {
                id: 1,
                name: "bug".into(),
                color: "d73a4a".into(),
            }),
            assignee: None,
            milestone: None,
            source: None,
            user: None,
            body: None,
        };
        let s = timeline_to_summary(&ev).unwrap();
        assert_eq!(s.event, "labeled");
        assert_eq!(s.label_name.as_deref(), Some("bug"));
        assert_eq!(s.actor_login.as_deref(), Some("octocat"));
    }

    #[test]
    fn timeline_to_summary_skips_unknown_events() {
        let ev = crate::github::types::TimelineEvent {
            id: Some(1),
            event: Some("subscribed".into()),
            created_at: Some("2026-04-20T00:00:00Z".into()),
            actor: None,
            label: None,
            assignee: None,
            milestone: None,
            source: None,
            user: None,
            body: None,
        };
        assert!(timeline_to_summary(&ev).is_none());
    }

    #[test]
    fn reaction_infos_from_counts_covers_all_contents() {
        let infos = reaction_infos_from_counts(Some(&crate::github::types::ReactionCounts {
            total_count: 3,
            plus_one: 2,
            minus_one: 0,
            laugh: 0,
            hooray: 1,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
        }));
        assert_eq!(infos.len(), 8);
        assert_eq!(infos[0].content, "+1");
        assert_eq!(infos[0].count, 2);
        assert_eq!(infos[3].content, "hooray");
        assert_eq!(infos[3].count, 1);
    }

    #[test]
    fn comment_to_summary_preserves_fields() {
        let user = user("alice");
        let c = crate::github::types::IssueComment {
            id: 99,
            user,
            body: "hi".into(),
            created_at: "2026-04-21T01:00:00Z".into(),
            updated_at: "2026-04-21T01:00:00Z".into(),
            html_url: "https://github.com/o/r/issues/1#c99".into(),
            author_association: Some("OWNER".into()),
            reactions: None,
        };
        let s = comment_to_summary(&c);
        assert_eq!(s.id, 99);
        assert_eq!(s.author.login, "alice");
        assert_eq!(s.body, "hi");
        assert_eq!(s.author_association.as_deref(), Some("OWNER"));
    }

    #[test]
    fn issue_to_summary_maps_all_fields() {
        let issue = sample_issue(
            9,
            "open",
            vec!["bug", "p0"],
            vec!["alice", "bob"],
            Some("v0.1"),
            "2026-04-21T00:00:00Z",
        );
        let s = issue_to_summary(&issue, "octocat/alpha");
        assert_eq!(s.number, 9);
        assert_eq!(s.repo, "octocat/alpha");
        assert_eq!(s.labels.len(), 2);
        assert_eq!(s.labels[0].name, "bug");
        assert_eq!(s.assignees.len(), 2);
        assert_eq!(s.assignees[1].login, "bob");
        assert_eq!(s.milestone.as_deref(), Some("v0.1"));
        assert_eq!(s.author.as_deref(), Some("octocat"));
    }

    fn report_with_issue_step(status: SyncStepStatus) -> SyncReport {
        SyncReport {
            started_at_epoch: 1,
            finished_at_epoch: 2,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 3,
                limit: 5000,
            }),
            steps: vec![SyncStepReport {
                scope: SyncScope::Issues,
                status,
                repos_seen: 1,
                items_written: if status == SyncStepStatus::Partial {
                    1
                } else {
                    0
                },
                errors: vec![SyncErrorSummary {
                    repo: Some("octocat/alpha".to_string()),
                    operation: "list_issues".to_string(),
                    message: "GitHub API error (HTTP 500): unavailable".to_string(),
                }],
            }],
        }
    }

    #[test]
    fn failed_step_error_returns_message_for_failed_issue_step() {
        let err = failed_step_error(
            &report_with_issue_step(SyncStepStatus::Failed),
            SyncScope::Issues,
        )
        .unwrap();
        assert!(err.contains("octocat/alpha"));
        assert!(err.contains("list_issues"));
        assert!(err.contains("unavailable"));
    }

    #[test]
    fn failed_step_error_ignores_partial_issue_step() {
        assert_eq!(
            failed_step_error(
                &report_with_issue_step(SyncStepStatus::Partial),
                SyncScope::Issues
            ),
            None
        );
    }
}
