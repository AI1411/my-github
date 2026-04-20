use crate::github::client::{ClientError, GithubClient};
use crate::github::types::{PullRequest, Repository};

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
}
