use serde::Serialize;

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::github::client::GithubClient;
use crate::github::rest::search_issues;
use crate::github::types::SearchIssueItem;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub repo: String,
    pub kind: String,
}

fn extract_repo(repository_url: &str) -> String {
    repository_url
        .trim_start_matches("https://api.github.com/repos/")
        .to_string()
}

fn search_item_to_result(item: &SearchIssueItem) -> SearchResultItem {
    let kind = if item.html_url.contains("/pull/") {
        "pull"
    } else {
        "issue"
    };
    SearchResultItem {
        id: item.id,
        number: item.number,
        title: item.title.clone(),
        state: item.state.clone(),
        html_url: item.html_url.clone(),
        repo: extract_repo(&item.repository_url),
        kind: kind.to_string(),
    }
}

#[tauri::command]
pub async fn cmd_search_github(query: String) -> Result<Vec<SearchResultItem>, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let items = search_issues(&client, &query)
        .await
        .map_err(|e| e.to_string())?;
    Ok(items.iter().map(search_item_to_result).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::types::{SearchIssueItem, User};

    fn user() -> User {
        User {
            id: 1,
            login: "octocat".into(),
            avatar_url: "".into(),
            html_url: "".into(),
            name: None,
        }
    }

    fn make_item(html_url: &str) -> SearchIssueItem {
        SearchIssueItem {
            id: 1,
            number: 5,
            title: "Fix it".into(),
            state: "open".into(),
            html_url: html_url.to_string(),
            repository_url: "https://api.github.com/repos/octocat/hello".into(),
            user: user(),
        }
    }

    #[test]
    fn extract_repo_strips_api_prefix() {
        assert_eq!(
            extract_repo("https://api.github.com/repos/octocat/hello"),
            "octocat/hello"
        );
    }

    #[test]
    fn search_item_to_result_identifies_pull() {
        let item = make_item("https://github.com/octocat/hello/pull/5");
        let r = search_item_to_result(&item);
        assert_eq!(r.kind, "pull");
        assert_eq!(r.repo, "octocat/hello");
    }

    #[test]
    fn search_item_to_result_identifies_issue() {
        let item = make_item("https://github.com/octocat/hello/issues/5");
        let r = search_item_to_result(&item);
        assert_eq!(r.kind, "issue");
    }
}
