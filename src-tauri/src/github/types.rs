use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct User {
    pub id: u64,
    pub login: String,
    pub avatar_url: String,
    pub html_url: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Label {
    pub id: u64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Repository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub owner: User,
    pub html_url: String,
    #[serde(default)]
    pub description: Option<String>,
    pub fork: bool,
    pub default_branch: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrRef {
    pub label: String,
    #[serde(rename = "ref")]
    pub ref_name: String,
    pub sha: String,
    #[serde(default)]
    pub repo: Option<Box<Repository>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullRequest {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub html_url: String,
    pub user: User,
    #[serde(default)]
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub merged_at: Option<String>,
    pub head: PrRef,
    pub base: PrRef,
    #[serde(default)]
    pub requested_reviewers: Vec<User>,
    /// Teams requested to review (single-PR endpoint and list when present).
    #[serde(default)]
    pub requested_teams: Vec<Team>,
    /// Only present on the single-PR endpoint (`GET /pulls/{number}`).
    #[serde(default)]
    pub mergeable: Option<bool>,
    /// Only present on the single-PR endpoint: clean / dirty / blocked /
    /// behind / unstable / draft / unknown.
    #[serde(default)]
    pub mergeable_state: Option<String>,
    #[serde(default)]
    pub labels: Vec<Label>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Team {
    pub id: u64,
    pub name: String,
    pub slug: String,
    /// Present when nested under an organization context.
    #[serde(default)]
    pub organization: Option<TeamOrg>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TeamOrg {
    pub login: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullRequestRef {
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Milestone {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub state: String,
    #[serde(default)]
    pub open_issues: u32,
    #[serde(default)]
    pub closed_issues: u32,
    #[serde(default)]
    pub due_on: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ReactionCounts {
    #[serde(default)]
    pub total_count: u32,
    #[serde(rename = "+1", default)]
    pub plus_one: u32,
    #[serde(rename = "-1", default)]
    pub minus_one: u32,
    #[serde(default)]
    pub laugh: u32,
    #[serde(default)]
    pub hooray: u32,
    #[serde(default)]
    pub confused: u32,
    #[serde(default)]
    pub heart: u32,
    #[serde(default)]
    pub rocket: u32,
    #[serde(default)]
    pub eyes: u32,
}

impl ReactionCounts {
    pub fn count_for(&self, content: &str) -> u32 {
        match content {
            "+1" => self.plus_one,
            "-1" => self.minus_one,
            "laugh" => self.laugh,
            "hooray" => self.hooray,
            "confused" => self.confused,
            "heart" => self.heart,
            "rocket" => self.rocket,
            "eyes" => self.eyes,
            _ => 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Reaction {
    pub id: u64,
    pub user: User,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CrossReferenceSource {
    #[serde(rename = "type", default)]
    pub source_type: Option<String>,
    #[serde(default)]
    pub issue: Option<Box<Issue>>,
}

/// Heterogeneous issue timeline event from
/// `GET /repos/{owner}/{repo}/issues/{number}/timeline`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineEvent {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(default)]
    pub event: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub actor: Option<User>,
    #[serde(default)]
    pub label: Option<Label>,
    #[serde(default)]
    pub assignee: Option<User>,
    #[serde(default)]
    pub milestone: Option<Milestone>,
    #[serde(default)]
    pub source: Option<CrossReferenceSource>,
    /// Present on `commented` events (and issue comment payloads).
    #[serde(default)]
    pub user: Option<User>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Issue {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub user: User,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub labels: Vec<Label>,
    #[serde(default)]
    pub assignees: Vec<User>,
    #[serde(default)]
    pub milestone: Option<Milestone>,
    #[serde(default)]
    pub comments: u32,
    #[serde(default)]
    pub author_association: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub closed_at: Option<String>,
    #[serde(default)]
    pub pull_request: Option<PullRequestRef>,
    #[serde(default)]
    pub reactions: Option<ReactionCounts>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IssueComment {
    pub id: u64,
    pub user: User,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    #[serde(default)]
    pub author_association: Option<String>,
    #[serde(default)]
    pub reactions: Option<ReactionCounts>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullReviewComment {
    pub id: u64,
    pub user: User,
    pub body: String,
    pub path: String,
    #[serde(default)]
    pub diff_hunk: Option<String>,
    #[serde(default)]
    pub commit_id: Option<String>,
    #[serde(default)]
    pub original_commit_id: Option<String>,
    #[serde(default)]
    pub in_reply_to_id: Option<u64>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    #[serde(default)]
    pub line: Option<u64>,
    #[serde(default)]
    pub original_line: Option<u64>,
    #[serde(default)]
    pub side: Option<String>,
    #[serde(default)]
    pub subject_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Review {
    pub id: u64,
    pub user: User,
    pub body: String,
    pub state: String,
    pub html_url: String,
    #[serde(default)]
    pub submitted_at: Option<String>,
    pub commit_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GitCommitUser {
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GitCommitDetail {
    pub message: String,
    pub author: Option<GitCommitUser>,
    pub committer: Option<GitCommitUser>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullCommit {
    pub sha: String,
    pub html_url: String,
    pub commit: GitCommitDetail,
    #[serde(default)]
    pub author: Option<User>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullRequestFile {
    pub sha: String,
    pub filename: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub blob_url: String,
    pub raw_url: String,
    #[serde(default)]
    pub patch: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CheckApp {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CheckRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    #[serde(default)]
    pub conclusion: Option<String>,
    #[serde(default)]
    pub started_at: Option<String>,
    #[serde(default)]
    pub completed_at: Option<String>,
    pub html_url: String,
    pub app: CheckApp,
    #[serde(default)]
    pub output: Option<CheckRunOutput>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct CheckRunOutput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CheckAnnotation {
    pub path: String,
    #[serde(default)]
    pub start_line: Option<u32>,
    #[serde(default)]
    pub end_line: Option<u32>,
    #[serde(default)]
    pub annotation_level: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CheckRunsResponse {
    pub total_count: u32,
    pub check_runs: Vec<CheckRun>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NotificationSubject {
    pub title: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub latest_comment_url: Option<String>,
    #[serde(rename = "type")]
    pub subject_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub unread: bool,
    pub reason: String,
    pub updated_at: String,
    pub url: String,
    pub subject: NotificationSubject,
    pub repository: Repository,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    #[serde(default)]
    pub conclusion: Option<String>,
    #[serde(default)]
    pub head_branch: Option<String>,
    pub run_number: u32,
    #[serde(default)]
    pub run_started_at: Option<String>,
    pub updated_at: String,
    pub html_url: String,
    pub workflow_id: u64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct WorkflowRunsResponse {
    pub total_count: u32,
    pub workflow_runs: Vec<WorkflowRun>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Release {
    pub id: u64,
    pub tag_name: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub published_at: Option<String>,
    pub html_url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchIssueItem {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub repository_url: String,
    pub user: User,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct SearchIssuesResponse {
    pub total_count: u32,
    pub items: Vec<SearchIssueItem>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RepoSearchItem {
    pub full_name: String,
    pub description: Option<String>,
    pub stargazers_count: u64,
    pub private: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct RepoSearchResponse {
    pub total_count: u32,
    pub items: Vec<RepoSearchItem>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CodeSearchTextMatch {
    pub fragment: Option<String>,
    pub property: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CodeSearchItem {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub html_url: String,
    #[serde(default)]
    pub text_matches: Vec<CodeSearchTextMatch>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CodeSearchResponse {
    pub total_count: u32,
    pub items: Vec<CodeSearchItem>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_user_from_json() {
        let json = r#"{
            "id": 1,
            "login": "octocat",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
            "html_url": "https://github.com/octocat"
        }"#;
        let user: User = serde_json::from_str(json).unwrap();
        assert_eq!(user.id, 1);
        assert_eq!(user.login, "octocat");
        assert_eq!(user.name, None);
    }

    #[test]
    fn deserialize_user_with_name() {
        let json = r#"{
            "id": 2,
            "login": "monalisa",
            "avatar_url": "https://avatars.githubusercontent.com/u/2",
            "html_url": "https://github.com/monalisa",
            "name": "Mona Lisa"
        }"#;
        let user: User = serde_json::from_str(json).unwrap();
        assert_eq!(user.name, Some("Mona Lisa".to_string()));
    }

    #[test]
    fn deserialize_label_from_json() {
        let json = r#"{"id": 100, "name": "bug", "color": "d73a4a"}"#;
        let label: Label = serde_json::from_str(json).unwrap();
        assert_eq!(label.id, 100);
        assert_eq!(label.name, "bug");
        assert_eq!(label.color, "d73a4a");
    }

    #[test]
    fn deserialize_repository_from_json() {
        let json = r#"{
            "id": 1296269,
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "private": false,
            "owner": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "html_url": "https://github.com/octocat/Hello-World",
            "description": "My first repo",
            "fork": false,
            "default_branch": "main"
        }"#;
        let repo: Repository = serde_json::from_str(json).unwrap();
        assert_eq!(repo.id, 1296269);
        assert_eq!(repo.full_name, "octocat/Hello-World");
        assert!(!repo.private);
        assert_eq!(repo.default_branch, "main");
        assert_eq!(repo.description, Some("My first repo".to_string()));
    }

    #[test]
    fn deserialize_repository_without_description() {
        let json = r#"{
            "id": 2,
            "name": "repo2",
            "full_name": "user/repo2",
            "private": true,
            "owner": {
                "id": 1,
                "login": "user",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/user"
            },
            "html_url": "https://github.com/user/repo2",
            "fork": false,
            "default_branch": "master"
        }"#;
        let repo: Repository = serde_json::from_str(json).unwrap();
        assert_eq!(repo.description, None);
        assert!(repo.private);
    }

    #[test]
    fn deserialize_pull_request_from_json() {
        let json = r#"{
            "id": 1,
            "number": 1347,
            "title": "Amazing new feature",
            "state": "open",
            "draft": false,
            "html_url": "https://github.com/octocat/Hello-World/pull/1347",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "body": "Please pull these changes",
            "created_at": "2011-01-26T19:01:12Z",
            "updated_at": "2011-01-26T19:01:12Z",
            "merged_at": null,
            "head": {
                "label": "octocat:new-feature",
                "ref": "new-feature",
                "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                "repo": null
            },
            "base": {
                "label": "octocat:master",
                "ref": "master",
                "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                "repo": null
            },
            "requested_reviewers": []
        }"#;
        let pr: PullRequest = serde_json::from_str(json).unwrap();
        assert_eq!(pr.number, 1347);
        assert_eq!(pr.title, "Amazing new feature");
        assert!(!pr.draft);
        assert_eq!(pr.merged_at, None);
        assert_eq!(pr.head.ref_name, "new-feature");
        assert_eq!(pr.requested_reviewers.len(), 0);
    }

    #[test]
    fn deserialize_issue_from_json() {
        let json = r#"{
            "id": 1,
            "number": 1347,
            "title": "Found a bug",
            "state": "open",
            "html_url": "https://github.com/octocat/Hello-World/issues/1347",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "body": "I found a bug",
            "labels": [{"id": 100, "name": "bug", "color": "d73a4a"}],
            "created_at": "2011-01-26T19:00:00Z",
            "updated_at": "2011-01-26T19:00:00Z",
            "closed_at": null
        }"#;
        let issue: Issue = serde_json::from_str(json).unwrap();
        assert_eq!(issue.number, 1347);
        assert_eq!(issue.labels.len(), 1);
        assert_eq!(issue.labels[0].name, "bug");
        assert_eq!(issue.pull_request, None);
    }

    #[test]
    fn deserialize_issue_with_assignees_and_milestone() {
        let json = r#"{
            "id": 11,
            "number": 7,
            "title": "Improve docs",
            "state": "open",
            "html_url": "https://github.com/o/r/issues/7",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://a/1",
                "html_url": "https://u/octocat"
            },
            "labels": [{"id": 1, "name": "docs", "color": "0075ca"}],
            "assignees": [
                {
                    "id": 2,
                    "login": "alice",
                    "avatar_url": "https://a/2",
                    "html_url": "https://u/alice"
                },
                {
                    "id": 3,
                    "login": "bob",
                    "avatar_url": "https://a/3",
                    "html_url": "https://u/bob"
                }
            ],
            "milestone": {
                "id": 100,
                "number": 4,
                "title": "v0.2",
                "state": "open",
                "open_issues": 3,
                "closed_issues": 5,
                "due_on": "2026-05-01T00:00:00Z"
            },
            "comments": 4,
            "author_association": "OWNER",
            "created_at": "2026-04-20T00:00:00Z",
            "updated_at": "2026-04-21T00:00:00Z",
            "closed_at": null
        }"#;
        let issue: Issue = serde_json::from_str(json).unwrap();
        assert_eq!(issue.assignees.len(), 2);
        assert_eq!(issue.assignees[0].login, "alice");
        assert_eq!(issue.milestone.as_ref().unwrap().title, "v0.2");
        assert_eq!(issue.milestone.as_ref().unwrap().open_issues, 3);
        assert_eq!(issue.comments, 4);
        assert_eq!(issue.author_association.as_deref(), Some("OWNER"));
    }

    #[test]
    fn issue_with_pull_request_field_is_distinguishable() {
        let json = r#"{
            "id": 2,
            "number": 5,
            "title": "PR as issue",
            "state": "open",
            "html_url": "https://github.com/octocat/Hello-World/issues/5",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "labels": [],
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "pull_request": {"url": "https://api.github.com/repos/octocat/Hello-World/pulls/5"}
        }"#;
        let issue: Issue = serde_json::from_str(json).unwrap();
        assert!(issue.pull_request.is_some());
    }

    #[test]
    fn deserialize_reaction_counts_with_plus_minus_keys() {
        let json = r#"{
            "url": "https://api.github.com/repos/o/r/issues/1/reactions",
            "total_count": 3,
            "+1": 2,
            "-1": 0,
            "laugh": 0,
            "hooray": 1,
            "confused": 0,
            "heart": 0,
            "rocket": 0,
            "eyes": 0
        }"#;
        let c: ReactionCounts = serde_json::from_str(json).unwrap();
        assert_eq!(c.total_count, 3);
        assert_eq!(c.plus_one, 2);
        assert_eq!(c.hooray, 1);
        assert_eq!(c.count_for("+1"), 2);
        assert_eq!(c.count_for("hooray"), 1);
    }

    #[test]
    fn deserialize_timeline_labeled_event() {
        let json = r#"{
            "id": 1,
            "event": "labeled",
            "created_at": "2026-04-20T00:00:00Z",
            "actor": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://a/1",
                "html_url": "https://u/octocat"
            },
            "label": { "id": 10, "name": "bug", "color": "d73a4a" }
        }"#;
        let ev: TimelineEvent = serde_json::from_str(json).unwrap();
        assert_eq!(ev.event.as_deref(), Some("labeled"));
        assert_eq!(ev.label.as_ref().unwrap().name, "bug");
        assert_eq!(ev.actor.as_ref().unwrap().login, "octocat");
    }

    #[test]
    fn deserialize_issue_comment_from_json() {
        let json = r#"{
            "id": 1,
            "user": {
                "id": 2,
                "login": "alice",
                "avatar_url": "https://a/2",
                "html_url": "https://u/alice"
            },
            "body": "Looks good!",
            "created_at": "2026-04-20T00:00:00Z",
            "updated_at": "2026-04-20T01:00:00Z",
            "html_url": "https://github.com/o/r/issues/1#issuecomment-1",
            "author_association": "MEMBER"
        }"#;
        let c: IssueComment = serde_json::from_str(json).unwrap();
        assert_eq!(c.id, 1);
        assert_eq!(c.user.login, "alice");
        assert_eq!(c.body, "Looks good!");
        assert_eq!(c.author_association.as_deref(), Some("MEMBER"));
    }

    #[test]
    fn deserialize_review_from_json() {
        let json = r#"{
            "id": 80,
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "body": "LGTM",
            "state": "APPROVED",
            "html_url": "https://github.com/octocat/Hello-World/pull/12#pullrequestreview-80",
            "submitted_at": "2019-08-05T14:20:28Z",
            "commit_id": "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091"
        }"#;
        let review: Review = serde_json::from_str(json).unwrap();
        assert_eq!(review.id, 80);
        assert_eq!(review.state, "APPROVED");
        assert_eq!(
            review.submitted_at,
            Some("2019-08-05T14:20:28Z".to_string())
        );
    }

    #[test]
    fn deserialize_pull_request_file_from_json() {
        let json = r#"{
            "sha": "abc123",
            "filename": "src/main.rs",
            "status": "modified",
            "additions": 10,
            "deletions": 2,
            "changes": 12,
            "blob_url": "https://github.com/octocat/repo/blob/abc123/src/main.rs",
            "raw_url": "https://github.com/octocat/repo/raw/abc123/src/main.rs",
            "patch": "@@ -1,2 +1,2 @@"
        }"#;
        let file: PullRequestFile = serde_json::from_str(json).unwrap();
        assert_eq!(file.filename, "src/main.rs");
        assert_eq!(file.additions, 10);
        assert_eq!(file.deletions, 2);
        assert_eq!(file.patch, Some("@@ -1,2 +1,2 @@".to_string()));
    }

    #[test]
    fn deserialize_pull_request_file_without_patch() {
        let json = r#"{
            "sha": "def456",
            "filename": "image.png",
            "status": "added",
            "additions": 0,
            "deletions": 0,
            "changes": 0,
            "blob_url": "https://github.com/octocat/repo/blob/def456/image.png",
            "raw_url": "https://github.com/octocat/repo/raw/def456/image.png"
        }"#;
        let file: PullRequestFile = serde_json::from_str(json).unwrap();
        assert_eq!(file.patch, None);
    }

    #[test]
    fn deserialize_check_run_from_json() {
        let json = r#"{
            "id": 1234,
            "name": "CI / test",
            "status": "completed",
            "conclusion": "success",
            "started_at": "2024-01-01T00:00:00Z",
            "completed_at": "2024-01-01T00:05:00Z",
            "html_url": "https://github.com/octocat/repo/actions/runs/1234",
            "app": {"id": 100, "name": "GitHub Actions"}
        }"#;
        let run: CheckRun = serde_json::from_str(json).unwrap();
        assert_eq!(run.id, 1234);
        assert_eq!(run.name, "CI / test");
        assert_eq!(run.conclusion, Some("success".to_string()));
        assert_eq!(run.app.name, "GitHub Actions");
    }

    #[test]
    fn deserialize_check_run_in_progress() {
        let json = r#"{
            "id": 5678,
            "name": "CI / build",
            "status": "in_progress",
            "conclusion": null,
            "started_at": "2024-01-01T00:00:00Z",
            "completed_at": null,
            "html_url": "https://github.com/octocat/repo/actions/runs/5678",
            "app": {"id": 100, "name": "GitHub Actions"}
        }"#;
        let run: CheckRun = serde_json::from_str(json).unwrap();
        assert_eq!(run.status, "in_progress");
        assert_eq!(run.conclusion, None);
        assert_eq!(run.completed_at, None);
    }

    #[test]
    fn deserialize_check_runs_response() {
        let json = r#"{
            "total_count": 1,
            "check_runs": [{
                "id": 1,
                "name": "test",
                "status": "completed",
                "conclusion": "failure",
                "started_at": "2024-01-01T00:00:00Z",
                "completed_at": "2024-01-01T00:01:00Z",
                "html_url": "https://github.com/octocat/repo/actions/runs/1",
                "app": {"id": 1, "name": "Actions"}
            }]
        }"#;
        let resp: CheckRunsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.total_count, 1);
        assert_eq!(resp.check_runs.len(), 1);
    }

    #[test]
    fn deserialize_notification_from_json() {
        let json = r#"{
            "id": "1",
            "unread": true,
            "reason": "review_requested",
            "updated_at": "2024-01-01T00:00:00Z",
            "url": "https://api.github.com/notifications/threads/1",
            "subject": {
                "title": "Fix bug",
                "url": "https://api.github.com/repos/octocat/Hello-World/pulls/1",
                "latest_comment_url": null,
                "type": "PullRequest"
            },
            "repository": {
                "id": 1296269,
                "name": "Hello-World",
                "full_name": "octocat/Hello-World",
                "private": false,
                "owner": {
                    "id": 1,
                    "login": "octocat",
                    "avatar_url": "https://avatars.githubusercontent.com/u/1",
                    "html_url": "https://github.com/octocat"
                },
                "html_url": "https://github.com/octocat/Hello-World",
                "fork": false,
                "default_branch": "main"
            }
        }"#;
        let notif: Notification = serde_json::from_str(json).unwrap();
        assert_eq!(notif.id, "1");
        assert!(notif.unread);
        assert_eq!(notif.reason, "review_requested");
        assert_eq!(notif.subject.subject_type, "PullRequest");
        assert_eq!(notif.subject.title, "Fix bug");
    }

    #[test]
    fn deserialize_review_without_submitted_at() {
        let json = r#"{
            "id": 81,
            "user": {
                "id": 2,
                "login": "reviewer",
                "avatar_url": "https://avatars.githubusercontent.com/u/2",
                "html_url": "https://github.com/reviewer"
            },
            "body": "",
            "state": "CHANGES_REQUESTED",
            "html_url": "https://github.com/octocat/repo/pull/1#pullrequestreview-81",
            "submitted_at": null,
            "commit_id": "abc123"
        }"#;
        let review: Review = serde_json::from_str(json).unwrap();
        assert_eq!(review.state, "CHANGES_REQUESTED");
        assert_eq!(review.submitted_at, None);
    }

    #[test]
    fn deserialize_pull_request_with_reviewer() {
        let json = r#"{
            "id": 2,
            "number": 2,
            "title": "Fix bug",
            "state": "open",
            "draft": true,
            "html_url": "https://github.com/octocat/Hello-World/pull/2",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "merged_at": "2024-01-02T00:00:00Z",
            "head": {
                "label": "octocat:fix",
                "ref": "fix",
                "sha": "abc123",
                "repo": null
            },
            "base": {
                "label": "octocat:main",
                "ref": "main",
                "sha": "def456",
                "repo": null
            },
            "requested_reviewers": [
                {
                    "id": 3,
                    "login": "reviewer",
                    "avatar_url": "https://avatars.githubusercontent.com/u/3",
                    "html_url": "https://github.com/reviewer"
                }
            ]
        }"#;
        let pr: PullRequest = serde_json::from_str(json).unwrap();
        assert!(pr.draft);
        assert_eq!(pr.merged_at, Some("2024-01-02T00:00:00Z".to_string()));
        assert_eq!(pr.requested_reviewers.len(), 1);
        assert_eq!(pr.requested_reviewers[0].login, "reviewer");
    }

    #[test]
    fn deserialize_workflow_run_from_json() {
        let json = r#"{
            "id": 9000,
            "name": "CI",
            "status": "completed",
            "conclusion": "failure",
            "head_branch": "main",
            "run_number": 42,
            "run_started_at": "2026-04-21T00:00:00Z",
            "updated_at": "2026-04-21T00:05:00Z",
            "html_url": "https://github.com/octocat/hello/actions/runs/9000",
            "workflow_id": 100
        }"#;
        let run: WorkflowRun = serde_json::from_str(json).unwrap();
        assert_eq!(run.id, 9000);
        assert_eq!(run.name, "CI");
        assert_eq!(run.conclusion, Some("failure".to_string()));
        assert_eq!(run.head_branch, Some("main".to_string()));
        assert_eq!(run.run_number, 42);
    }

    #[test]
    fn deserialize_workflow_run_in_progress() {
        let json = r#"{
            "id": 9001,
            "name": "Test",
            "status": "in_progress",
            "conclusion": null,
            "run_number": 5,
            "updated_at": "2026-04-21T00:01:00Z",
            "html_url": "https://github.com/o/r/actions/runs/9001",
            "workflow_id": 200
        }"#;
        let run: WorkflowRun = serde_json::from_str(json).unwrap();
        assert_eq!(run.status, "in_progress");
        assert_eq!(run.conclusion, None);
        assert_eq!(run.head_branch, None);
        assert_eq!(run.run_started_at, None);
    }

    #[test]
    fn deserialize_workflow_runs_response() {
        let json = r#"{
            "total_count": 1,
            "workflow_runs": [{
                "id": 1,
                "name": "build",
                "status": "completed",
                "conclusion": "success",
                "run_number": 1,
                "updated_at": "2026-04-21T00:00:00Z",
                "html_url": "https://github.com/o/r/actions/runs/1",
                "workflow_id": 10
            }]
        }"#;
        let resp: WorkflowRunsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.total_count, 1);
        assert_eq!(resp.workflow_runs.len(), 1);
    }

    #[test]
    fn deserialize_release_from_json() {
        let json = r#"{
            "id": 1,
            "tag_name": "v1.0.0",
            "name": "First release",
            "draft": false,
            "prerelease": false,
            "published_at": "2026-07-01T00:00:00Z",
            "html_url": "https://github.com/octocat/hello/releases/tag/v1.0.0"
        }"#;
        let release: Release = serde_json::from_str(json).unwrap();
        assert_eq!(release.id, 1);
        assert_eq!(release.tag_name, "v1.0.0");
        assert_eq!(release.name.as_deref(), Some("First release"));
        assert!(!release.prerelease);
    }

    #[test]
    fn deserialize_release_without_optional_fields() {
        let json = r#"{
            "id": 2,
            "tag_name": "v0.1.0-rc1",
            "prerelease": true,
            "html_url": "https://github.com/octocat/hello/releases/tag/v0.1.0-rc1"
        }"#;
        let release: Release = serde_json::from_str(json).unwrap();
        assert_eq!(release.name, None);
        assert_eq!(release.published_at, None);
        assert!(release.prerelease);
    }

    #[test]
    fn deserialize_search_issue_item() {
        let json = r#"{
            "id": 500,
            "number": 7,
            "title": "Fix the thing",
            "state": "open",
            "html_url": "https://github.com/octocat/hello/issues/7",
            "repository_url": "https://api.github.com/repos/octocat/hello",
            "user": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://a/1",
                "html_url": "https://github.com/octocat"
            }
        }"#;
        let item: SearchIssueItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.id, 500);
        assert_eq!(item.number, 7);
        assert_eq!(item.title, "Fix the thing");
    }

    #[test]
    fn code_search_item_deserializes_with_snippet() {
        let json = r#"{
            "name": "lib.rs",
            "path": "src/lib.rs",
            "sha": "abc123",
            "html_url": "https://github.com/octocat/hello/blob/main/src/lib.rs",
            "text_matches": [
                {
                    "fragment": "pub fn ping() {}",
                    "property": "content"
                }
            ]
        }"#;
        let item: CodeSearchItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.path, "src/lib.rs");
        assert_eq!(
            item.text_matches[0].fragment.as_deref(),
            Some("pub fn ping() {}")
        );
    }

    #[test]
    fn repo_search_response_deserializes() {
        let json = r#"{
            "total_count": 2,
            "items": [
                {
                    "full_name": "octocat/hello",
                    "description": "A hello world repo",
                    "stargazers_count": 42,
                    "private": false
                },
                {
                    "full_name": "octocat/secret",
                    "description": null,
                    "stargazers_count": 0,
                    "private": true
                }
            ]
        }"#;
        let resp: RepoSearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.items.len(), 2);
        assert_eq!(resp.items[0].full_name, "octocat/hello");
        assert_eq!(
            resp.items[0].description,
            Some("A hello world repo".to_string())
        );
        assert_eq!(resp.items[0].stargazers_count, 42);
        assert!(resp.items[1].private);
        assert!(resp.items[1].description.is_none());
    }
}
