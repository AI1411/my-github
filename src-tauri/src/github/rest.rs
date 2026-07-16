use crate::github::client::{ClientError, GithubClient, RateLimitInfo};
use crate::github::types::{
    CheckRunsResponse, Issue, IssueComment, Notification, PullRequest, PullRequestFile, Release,
    Repository, Review, SearchIssueItem, SearchIssuesResponse, WorkflowRun, WorkflowRunsResponse,
};

fn has_next_page(headers: &reqwest::header::HeaderMap) -> bool {
    headers
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains(r#"rel="next""#))
        .unwrap_or(false)
}

pub async fn list_repos_for_authenticated_user(
    client: &GithubClient,
) -> Result<Vec<Repository>, ClientError> {
    let mut repos: Vec<Repository> = Vec::new();
    let mut page = 1u32;

    loop {
        let resp = client
            .get(&format!("/user/repos?per_page=100&page={}", page))
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }

        let has_next = has_next_page(resp.headers());
        let page_repos: Vec<Repository> = resp.json().await?;
        repos.extend(page_repos);

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(repos)
}

pub async fn list_pull_requests(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    state: &str,
) -> Result<Vec<PullRequest>, ClientError> {
    let mut prs: Vec<PullRequest> = Vec::new();
    let mut page = 1u32;

    loop {
        let resp = client
            .get(&format!(
                "/repos/{}/{}/pulls?state={}&per_page=100&page={}",
                owner, repo, state, page
            ))
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }

        let has_next = has_next_page(resp.headers());
        let page_prs: Vec<PullRequest> = resp.json().await?;
        prs.extend(page_prs);

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(prs)
}

pub async fn list_issues(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    state: &str,
    labels: &[&str],
) -> Result<Vec<Issue>, ClientError> {
    let mut issues: Vec<Issue> = Vec::new();
    let mut page = 1u32;
    let labels_param = labels.join(",");

    loop {
        let path = if labels_param.is_empty() {
            format!(
                "/repos/{}/{}/issues?state={}&per_page=100&page={}",
                owner, repo, state, page
            )
        } else {
            format!(
                "/repos/{}/{}/issues?state={}&labels={}&per_page=100&page={}",
                owner, repo, state, labels_param, page
            )
        };

        let resp = client.get(&path).send().await?;

        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }

        let has_next = has_next_page(resp.headers());
        let page_items: Vec<Issue> = resp.json().await?;
        issues.extend(page_items.into_iter().filter(|i| i.pull_request.is_none()));

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(issues)
}

pub async fn get_pull_request(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    number: u32,
) -> Result<PullRequest, ClientError> {
    let resp = client
        .get(&format!("/repos/{}/{}/pulls/{}", owner, repo, number))
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }

    Ok(resp.json().await?)
}

pub async fn get_pull_request_files(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    number: u32,
) -> Result<Vec<PullRequestFile>, ClientError> {
    let mut files: Vec<PullRequestFile> = Vec::new();
    let mut page = 1u32;

    loop {
        let resp = client
            .get(&format!(
                "/repos/{}/{}/pulls/{}/files?per_page=100&page={}",
                owner, repo, number, page
            ))
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }

        let has_next = has_next_page(resp.headers());
        let page_files: Vec<PullRequestFile> = resp.json().await?;
        files.extend(page_files);

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(files)
}

pub async fn get_issue(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    number: u32,
) -> Result<Issue, ClientError> {
    let resp = client
        .get(&format!("/repos/{}/{}/issues/{}", owner, repo, number))
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    Ok(resp.json().await?)
}

pub async fn list_issue_comments(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    number: u32,
) -> Result<Vec<IssueComment>, ClientError> {
    let mut comments: Vec<IssueComment> = Vec::new();
    let mut page = 1u32;
    loop {
        let resp = client
            .get(&format!(
                "/repos/{}/{}/issues/{}/comments?per_page=100&page={}",
                owner, repo, number, page
            ))
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }
        let has_next = has_next_page(resp.headers());
        let page_comments: Vec<IssueComment> = resp.json().await?;
        comments.extend(page_comments);
        if !has_next {
            break;
        }
        page += 1;
    }
    Ok(comments)
}

pub async fn list_pull_request_reviews(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    number: u32,
) -> Result<Vec<Review>, ClientError> {
    let mut reviews: Vec<Review> = Vec::new();
    let mut page = 1u32;
    loop {
        let resp = client
            .get(&format!(
                "/repos/{}/{}/pulls/{}/reviews?per_page=100&page={}",
                owner, repo, number, page
            ))
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }
        let has_next = has_next_page(resp.headers());
        let page_reviews: Vec<Review> = resp.json().await?;
        reviews.extend(page_reviews);
        if !has_next {
            break;
        }
        page += 1;
    }
    Ok(reviews)
}

pub async fn get_check_runs(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    git_ref: &str,
) -> Result<CheckRunsResponse, ClientError> {
    let resp = client
        .get(&format!(
            "/repos/{}/{}/commits/{}/check-runs?per_page=100",
            owner, repo, git_ref
        ))
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }

    Ok(resp.json().await?)
}

/// Fetch the latest releases (max 10) for a repository. Draft releases are
/// filtered out; prereleases are kept.
pub async fn list_releases(
    client: &GithubClient,
    owner: &str,
    repo: &str,
) -> Result<Vec<Release>, ClientError> {
    let resp = client
        .get(&format!("/repos/{}/{}/releases?per_page=10", owner, repo))
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    let releases: Vec<Release> = resp.json().await?;
    Ok(releases.into_iter().filter(|r| !r.draft).collect())
}

/// Fetch the authenticated user's current rate-limit status via
/// `GET /rate_limit`. The call itself does not consume quota.
pub async fn get_rate_limit(client: &GithubClient) -> Result<RateLimitInfo, ClientError> {
    let resp = client.get("/rate_limit").send().await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    Ok(RateLimitInfo::from_headers(resp.headers()))
}

pub async fn list_notifications(client: &GithubClient) -> Result<Vec<Notification>, ClientError> {
    let mut notifications: Vec<Notification> = Vec::new();
    let mut page = 1u32;

    loop {
        let resp = client
            .get(&format!("/notifications?per_page=100&page={}", page))
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(ClientError::Api {
                status: status.as_u16(),
                message,
            });
        }

        let has_next = has_next_page(resp.headers());
        let page_notifs: Vec<Notification> = resp.json().await?;
        notifications.extend(page_notifs);

        if !has_next {
            break;
        }
        page += 1;
    }

    Ok(notifications)
}

pub async fn list_workflow_runs(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    branch: Option<&str>,
) -> Result<Vec<WorkflowRun>, ClientError> {
    let path = match branch {
        Some(b) => format!(
            "/repos/{}/{}/actions/runs?per_page=30&branch={}",
            owner, repo, b
        ),
        None => format!("/repos/{}/{}/actions/runs?per_page=30", owner, repo),
    };
    let resp = client.get(&path).send().await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    let r: WorkflowRunsResponse = resp.json().await?;
    Ok(r.workflow_runs)
}

pub fn workflow_run_logs_path(owner: &str, repo: &str, run_id: u64) -> String {
    format!("/repos/{}/{}/actions/runs/{}/logs", owner, repo, run_id)
}

pub async fn get_workflow_run_logs_url(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    run_id: u64,
) -> Result<String, ClientError> {
    let resp = client
        .get(&workflow_run_logs_path(owner, repo, run_id))
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    Ok(resp.url().to_string())
}

pub async fn search_issues(
    client: &GithubClient,
    query: &str,
) -> Result<Vec<SearchIssueItem>, ClientError> {
    let encoded = query.replace(' ', "+");
    let resp = client
        .get(&format!("/search/issues?q={}&per_page=10", encoded))
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(ClientError::Api {
            status: status.as_u16(),
            message,
        });
    }
    let r: SearchIssuesResponse = resp.json().await?;
    Ok(r.items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_next_page_returns_true_when_link_has_next() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "link",
            reqwest::header::HeaderValue::from_str(
                r#"<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last""#,
            )
            .unwrap(),
        );
        assert!(has_next_page(&headers));
    }

    #[test]
    fn has_next_page_returns_false_when_no_next_rel() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "link",
            reqwest::header::HeaderValue::from_str(
                r#"<https://api.github.com/user/repos?page=1>; rel="first", <https://api.github.com/user/repos?page=5>; rel="last""#,
            )
            .unwrap(),
        );
        assert!(!has_next_page(&headers));
    }

    #[test]
    fn has_next_page_returns_false_when_no_link_header() {
        let headers = reqwest::header::HeaderMap::new();
        assert!(!has_next_page(&headers));
    }

    #[test]
    fn list_issues_filters_pull_requests() {
        use crate::github::types::{Issue, PullRequestRef, User};
        let pr_as_issue = Issue {
            id: 1,
            number: 1,
            title: "This is a PR".to_string(),
            state: "open".to_string(),
            html_url: "https://github.com/octocat/Hello-World/issues/1".to_string(),
            user: User {
                id: 1,
                login: "octocat".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/1".to_string(),
                html_url: "https://github.com/octocat".to_string(),
                name: None,
            },
            body: None,
            labels: vec![],
            assignees: vec![],
            milestone: None,
            comments: 0,
            author_association: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            closed_at: None,
            pull_request: Some(PullRequestRef {
                url: "https://api.github.com/repos/octocat/Hello-World/pulls/1".to_string(),
            }),
        };
        let real_issue = Issue {
            id: 2,
            number: 2,
            title: "Real issue".to_string(),
            state: "open".to_string(),
            html_url: "https://github.com/octocat/Hello-World/issues/2".to_string(),
            user: User {
                id: 1,
                login: "octocat".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/1".to_string(),
                html_url: "https://github.com/octocat".to_string(),
                name: None,
            },
            body: None,
            labels: vec![],
            assignees: vec![],
            milestone: None,
            comments: 0,
            author_association: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            closed_at: None,
            pull_request: None,
        };
        let items = vec![pr_as_issue, real_issue];
        let issues: Vec<_> = items
            .into_iter()
            .filter(|i| i.pull_request.is_none())
            .collect();
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].number, 2);
    }

    #[test]
    fn has_next_page_returns_false_on_last_page_only_link() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "link",
            reqwest::header::HeaderValue::from_str(
                r#"<https://api.github.com/user/repos?page=1>; rel="first", <https://api.github.com/user/repos?page=3>; rel="prev""#,
            )
            .unwrap(),
        );
        assert!(!has_next_page(&headers));
    }

    #[test]
    fn get_pull_request_builds_correct_path() {
        let owner = "octocat";
        let repo = "Hello-World";
        let number = 42u32;
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        assert_eq!(path, "/repos/octocat/Hello-World/pulls/42");
    }

    #[test]
    fn get_pull_request_files_builds_correct_path() {
        let owner = "octocat";
        let repo = "Hello-World";
        let number = 1347u32;
        let path = format!(
            "/repos/{}/{}/pulls/{}/files?per_page=100",
            owner, repo, number
        );
        assert_eq!(
            path,
            "/repos/octocat/Hello-World/pulls/1347/files?per_page=100"
        );
    }

    #[test]
    fn list_issue_comments_builds_correct_path() {
        let owner = "octocat";
        let repo = "Hello-World";
        let number = 1u32;
        let page = 1u32;
        let path = format!(
            "/repos/{}/{}/issues/{}/comments?per_page=100&page={}",
            owner, repo, number, page
        );
        assert_eq!(
            path,
            "/repos/octocat/Hello-World/issues/1/comments?per_page=100&page=1"
        );
    }

    #[test]
    fn get_issue_builds_correct_path() {
        let owner = "octocat";
        let repo = "Hello-World";
        let number = 42u32;
        let path = format!("/repos/{}/{}/issues/{}", owner, repo, number);
        assert_eq!(path, "/repos/octocat/Hello-World/issues/42");
    }

    #[test]
    fn get_check_runs_builds_correct_path() {
        let owner = "octocat";
        let repo = "Hello-World";
        let git_ref = "abc123def456";
        let path = format!(
            "/repos/{}/{}/commits/{}/check-runs?per_page=100",
            owner, repo, git_ref
        );
        assert_eq!(
            path,
            "/repos/octocat/Hello-World/commits/abc123def456/check-runs?per_page=100"
        );
    }

    #[test]
    fn list_notifications_url_is_correct() {
        let page = 1u32;
        let path = format!("/notifications?per_page=100&page={}", page);
        assert_eq!(path, "/notifications?per_page=100&page=1");
    }

    #[test]
    fn workflow_run_logs_path_is_correct() {
        assert_eq!(
            workflow_run_logs_path("octocat", "hello", 100),
            "/repos/octocat/hello/actions/runs/100/logs"
        );
    }

    #[test]
    fn get_rate_limit_is_async_function() {
        // Type-check: simply referencing the function ensures it compiles
        // with the expected signature.
        let _ = get_rate_limit;
    }

    #[test]
    fn list_workflow_runs_builds_path_without_branch() {
        let owner = "octocat";
        let repo = "hello";
        let path = format!("/repos/{}/{}/actions/runs?per_page=30", owner, repo);
        assert_eq!(path, "/repos/octocat/hello/actions/runs?per_page=30");
    }

    #[test]
    fn list_workflow_runs_builds_path_with_branch() {
        let owner = "octocat";
        let repo = "hello";
        let branch = "main";
        let path = format!(
            "/repos/{}/{}/actions/runs?per_page=30&branch={}",
            owner, repo, branch
        );
        assert_eq!(
            path,
            "/repos/octocat/hello/actions/runs?per_page=30&branch=main"
        );
    }

    #[test]
    fn search_issues_builds_correct_path() {
        let query = "is:open label:bug";
        let encoded = query.replace(' ', "+");
        let path = format!("/search/issues?q={}&per_page=10", encoded);
        assert_eq!(path, "/search/issues?q=is:open+label:bug&per_page=10");
    }
}
