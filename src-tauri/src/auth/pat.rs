use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize)]
pub struct PatUser {
    pub login: String,
    pub id: u64,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: String,
}

#[derive(Debug, Error)]
pub enum PatError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("invalid or expired PAT (HTTP {status})")]
    Unauthorized { status: u16 },
    #[error("missing required field: {field}")]
    MissingField { field: &'static str },
}

#[derive(Debug, Deserialize)]
struct RawUser {
    login: Option<String>,
    id: Option<u64>,
    name: Option<String>,
    email: Option<String>,
    avatar_url: Option<String>,
}

/// Validates a GitHub Personal Access Token.
///
/// Returns user information and the list of granted OAuth scopes.
pub async fn validate_pat(
    client: &Client,
    token: &str,
) -> Result<(PatUser, Vec<String>), PatError> {
    let resp = client
        .get("https://api.github.com/user")
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "pulse-app")
        .send()
        .await?;

    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(PatError::Unauthorized { status: status.as_u16() });
    }

    let scopes = resp
        .headers()
        .get("X-OAuth-Scopes")
        .and_then(|v| v.to_str().ok())
        .map(parse_scopes)
        .unwrap_or_default();

    let raw: RawUser = resp.error_for_status()?.json().await?;

    let user = PatUser {
        login: raw.login.ok_or(PatError::MissingField { field: "login" })?,
        id: raw.id.ok_or(PatError::MissingField { field: "id" })?,
        name: raw.name,
        email: raw.email,
        avatar_url: raw.avatar_url.ok_or(PatError::MissingField { field: "avatar_url" })?,
    };

    Ok((user, scopes))
}

fn parse_scopes(header: &str) -> Vec<String> {
    header
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_scopes_single() {
        let scopes = parse_scopes("repo");
        assert_eq!(scopes, vec!["repo"]);
    }

    #[test]
    fn parse_scopes_multiple() {
        let scopes = parse_scopes("repo, read:org, notifications");
        assert_eq!(scopes, vec!["repo", "read:org", "notifications"]);
    }

    #[test]
    fn parse_scopes_empty_string() {
        let scopes = parse_scopes("");
        assert!(scopes.is_empty());
    }

    #[test]
    fn parse_scopes_strips_whitespace() {
        let scopes = parse_scopes("  repo  ,  workflow  ");
        assert_eq!(scopes, vec!["repo", "workflow"]);
    }

    #[test]
    fn pat_unauthorized_error_message() {
        let err = PatError::Unauthorized { status: 401 };
        assert_eq!(err.to_string(), "invalid or expired PAT (HTTP 401)");
    }

    #[test]
    fn raw_user_deserializes() {
        let json = r#"{"login":"octocat","id":1,"avatar_url":"https://github.com/images/error/octocat_happy.gif","name":"monalisa octocat","email":"octocat@github.com"}"#;
        let raw: RawUser = serde_json::from_str(json).unwrap();
        assert_eq!(raw.login.unwrap(), "octocat");
        assert_eq!(raw.id.unwrap(), 1u64);
    }
}
