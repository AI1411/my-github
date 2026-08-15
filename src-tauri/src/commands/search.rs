use serde::Serialize;

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::github::client::GithubClient;
use crate::github::rest::{search_code, search_issues, search_repositories};
use crate::github::types::{CodeSearchItem, RepoSearchItem, SearchIssueItem};

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSearchResult {
    pub full_name: String,
    pub description: Option<String>,
    pub stars: u64,
    pub private: bool,
}

fn repo_item_to_result(item: &RepoSearchItem) -> RepoSearchResult {
    RepoSearchResult {
        full_name: item.full_name.clone(),
        description: item.description.clone(),
        stars: item.stargazers_count,
        private: item.private,
    }
}

// 検索対象をサインイン中アカウントが所有するリポジトリに限定する
fn build_repo_search_query(query: &str, login: &str) -> String {
    format!("{query} user:{login}")
}

#[tauri::command]
pub async fn cmd_search_repositories(query: String) -> Result<Vec<RepoSearchResult>, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let scoped_query = build_repo_search_query(&query, &account_id);
    let items = search_repositories(&client, &scoped_query)
        .await
        .map_err(|e| e.to_string())?;
    Ok(items.iter().map(repo_item_to_result).collect())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeSearchResult {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub html_url: String,
    pub snippet: String,
}

/// Build `q` for GET /search/code — `terms repo:owner/name`.
fn build_code_search_query(query: &str, repo: &str) -> String {
    let q = query.trim();
    let r = repo.trim();
    if q.is_empty() {
        format!("repo:{r}")
    } else {
        format!("{q} repo:{r}")
    }
}

fn code_item_to_result(item: &CodeSearchItem) -> CodeSearchResult {
    let snippet = item
        .text_matches
        .iter()
        .find_map(|m| m.fragment.as_ref())
        .cloned()
        .unwrap_or_default();
    CodeSearchResult {
        name: item.name.clone(),
        path: item.path.clone(),
        sha: item.sha.clone(),
        html_url: item.html_url.clone(),
        snippet,
    }
}

#[tauri::command]
pub async fn cmd_search_code(repo: String, query: String) -> Result<Vec<CodeSearchResult>, String> {
    let repo = repo.trim().to_string();
    let query = query.trim().to_string();
    if repo.is_empty() {
        return Err("repo is required".to_string());
    }
    if query.is_empty() {
        return Err("query is required".to_string());
    }
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let scoped = build_code_search_query(&query, &repo);
    let items = search_code(&client, &scoped)
        .await
        .map_err(|e| e.to_string())?;
    Ok(items.iter().map(code_item_to_result).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::types::{CodeSearchTextMatch, SearchIssueItem, User};

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

    #[test]
    fn repo_item_to_result_maps_fields() {
        let item = RepoSearchItem {
            full_name: "octocat/hello".into(),
            description: Some("A repo".into()),
            stargazers_count: 42,
            private: true,
        };
        let r = repo_item_to_result(&item);
        assert_eq!(r.full_name, "octocat/hello");
        assert_eq!(r.description, Some("A repo".to_string()));
        assert_eq!(r.stars, 42);
        assert!(r.private);
    }

    #[test]
    fn build_repo_search_query_scopes_to_user() {
        assert_eq!(
            build_repo_search_query("hello", "AI1411"),
            "hello user:AI1411"
        );
    }

    #[test]
    fn repo_search_result_serializes_camel_case() {
        let r = RepoSearchResult {
            full_name: "octocat/hello".into(),
            description: None,
            stars: 1,
            private: false,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"fullName\""));
        assert!(json.contains("\"stars\""));
        assert!(json.contains("\"private\""));
    }

    #[test]
    fn build_code_search_query_appends_repo() {
        assert_eq!(
            build_code_search_query("fn ping", "octocat/hello"),
            "fn ping repo:octocat/hello"
        );
        assert_eq!(
            build_code_search_query("  path:src ", "o/r"),
            "path:src repo:o/r"
        );
    }

    #[test]
    fn code_item_to_result_uses_first_fragment() {
        let item = CodeSearchItem {
            name: "lib.rs".into(),
            path: "src/lib.rs".into(),
            sha: "abc".into(),
            html_url: "https://github.com/o/r/blob/main/src/lib.rs".into(),
            text_matches: vec![CodeSearchTextMatch {
                fragment: Some("pub fn ping() {}".into()),
                property: Some("content".into()),
            }],
        };
        let r = code_item_to_result(&item);
        assert_eq!(r.path, "src/lib.rs");
        assert_eq!(r.snippet, "pub fn ping() {}");
        assert_eq!(r.html_url, item.html_url);
    }

    #[test]
    fn code_search_result_serializes_camel_case() {
        let r = CodeSearchResult {
            name: "a.rs".into(),
            path: "src/a.rs".into(),
            sha: "1".into(),
            html_url: "https://github.com/o/r/blob/HEAD/src/a.rs".into(),
            snippet: "hi".into(),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"htmlUrl\""));
        assert!(json.contains("\"snippet\""));
    }
}
