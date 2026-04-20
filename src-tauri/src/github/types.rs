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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullRequestRef {
    pub url: String,
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
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub closed_at: Option<String>,
    #[serde(default)]
    pub pull_request: Option<PullRequestRef>,
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
        assert_eq!(review.submitted_at, Some("2019-08-05T14:20:28Z".to_string()));
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
}
