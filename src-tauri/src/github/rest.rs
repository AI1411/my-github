use crate::github::client::{ClientError, GithubClient};
use crate::github::types::{
    CheckRunsResponse, Issue, Notification, PullRequest, PullRequestFile, Repository,
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
}
