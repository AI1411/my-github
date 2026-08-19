use std::time::Duration;
use thiserror::Error;

const USER_AGENT: &str = "my-github/0.1";
const GITHUB_API_BASE: &str = "https://api.github.com";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Error)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("GitHub API error (HTTP {status}): {message}")]
    Api { status: u16, message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RateLimitInfo {
    pub remaining: u32,
    pub reset: u64,
    #[serde(default = "default_rate_limit")]
    pub limit: u32,
}

fn default_rate_limit() -> u32 {
    5000
}

impl RateLimitInfo {
    pub fn from_headers(headers: &reqwest::header::HeaderMap) -> Self {
        let limit = headers
            .get("x-ratelimit-limit")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or_else(default_rate_limit);
        let remaining = headers
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(u32::MAX);
        let reset = headers
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        Self {
            remaining,
            reset,
            limit,
        }
    }

    pub fn is_exhausted(&self) -> bool {
        self.remaining == 0
    }

    pub fn is_low(&self) -> bool {
        if self.limit == 0 {
            return false;
        }
        self.remaining < self.limit / 4
    }
}

/// HTTP client for GitHub REST/GraphQL.
///
/// Default base is `https://api.github.com`. For GHES, construct with
/// [`GithubClient::with_base_url`] (typically `https://host/api/v3`).
/// Call sites that load the active account token should pass the stored
/// per-account API base when set so requests route to the correct host.
#[derive(Debug, Clone)]
pub struct GithubClient {
    inner: reqwest::Client,
    token: String,
    base_url: String,
}

impl GithubClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self::with_base_url(token, GITHUB_API_BASE)
    }

    fn build_http_client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    }

    /// Create a client pointed at a specific API base (no trailing slash).
    pub fn with_base_url(token: impl Into<String>, base_url: impl Into<String>) -> Self {
        let base = base_url.into().trim_end_matches('/').to_string();
        Self {
            inner: Self::build_http_client(),
            token: token.into(),
            base_url: if base.is_empty() {
                GITHUB_API_BASE.to_string()
            } else {
                base
            },
        }
    }

    /// Default github.com API base.
    pub fn default_base_url() -> &'static str {
        GITHUB_API_BASE
    }

    /// Instance API base URL (github.com or GHES `/api/v3`).
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn user_agent() -> &'static str {
        USER_AGENT
    }

    pub fn get(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .get(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }

    pub fn post(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .post(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }

    pub fn put(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .put(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }

    pub fn patch(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .patch(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }

    pub fn delete(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .delete(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }
}

/// Build a [`GithubClient`] for the given account login using its stored token
/// and optional GHES API base (`token_store::load_host`).
pub fn client_for_account(account_id: &str) -> Result<GithubClient, String> {
    use crate::auth::token_store::{load_host, load_token};
    let token = load_token(account_id).ok_or_else(|| "no token for account".to_string())?;
    Ok(match load_host(account_id) {
        Some(base) if !base.is_empty() => GithubClient::with_base_url(token, base),
        _ => GithubClient::new(token),
    })
}

/// Active-account client (last account id + token + host).
pub fn client_for_active_account() -> Result<GithubClient, String> {
    use crate::auth::token_store::load_last_account_id;
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    client_for_account(&account_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_stores_token() {
        let client = GithubClient::new("gho_test123");
        assert_eq!(client.token, "gho_test123");
        assert_eq!(client.base_url(), GITHUB_API_BASE);
    }

    #[test]
    fn with_base_url_uses_ghes_api() {
        let client =
            GithubClient::with_base_url("gho_x", "https://github.example.com/api/v3/");
        assert_eq!(client.base_url(), "https://github.example.com/api/v3");
        let req = client.get("/user").build().unwrap();
        assert_eq!(
            req.url().as_str(),
            "https://github.example.com/api/v3/user"
        );
    }

    #[test]
    fn default_base_url_is_github_api() {
        assert_eq!(GithubClient::default_base_url(), "https://api.github.com");
    }

    #[test]
    fn user_agent_contains_app_name() {
        assert!(GithubClient::user_agent().contains("my-github"));
    }

    #[test]
    fn post_builds_request_with_auth_header() {
        let client = GithubClient::new("gho_mytoken");
        let req = client.post("/graphql").build().unwrap();
        assert_eq!(req.method(), reqwest::Method::POST);
        let auth = req
            .headers()
            .get("Authorization")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(auth, "Bearer gho_mytoken");
    }

    #[test]
    fn get_builds_request_with_auth_header() {
        let client = GithubClient::new("gho_mytoken");
        let req = client.get("/user").build().unwrap();
        let auth = req
            .headers()
            .get("Authorization")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(auth, "Bearer gho_mytoken");
        let ua = req.headers().get("User-Agent").unwrap().to_str().unwrap();
        assert_eq!(ua, "my-github/0.1");
        let accept = req.headers().get("Accept").unwrap().to_str().unwrap();
        assert_eq!(accept, "application/vnd.github+json");
    }

    #[test]
    fn rate_limit_info_from_full_headers() {
        let info = RateLimitInfo {
            remaining: 42,
            reset: 1700000000,
            limit: 5000,
        };
        assert_eq!(info.remaining, 42);
        assert_eq!(info.reset, 1700000000);
        assert_eq!(info.limit, 5000);
    }

    #[test]
    fn parse_rate_limit_parses_valid_headers() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "x-ratelimit-limit",
            reqwest::header::HeaderValue::from_str("5000").unwrap(),
        );
        headers.insert(
            "x-ratelimit-remaining",
            reqwest::header::HeaderValue::from_str("58").unwrap(),
        );
        headers.insert(
            "x-ratelimit-reset",
            reqwest::header::HeaderValue::from_str("1700000000").unwrap(),
        );
        let info = RateLimitInfo::from_headers(&headers);
        assert_eq!(info.limit, 5000);
        assert_eq!(info.remaining, 58);
        assert_eq!(info.reset, 1700000000);
    }

    #[test]
    fn parse_rate_limit_defaults_when_headers_missing() {
        let headers = reqwest::header::HeaderMap::new();
        let info = RateLimitInfo::from_headers(&headers);
        assert_eq!(info.limit, 5000);
        assert_eq!(info.remaining, u32::MAX);
        assert_eq!(info.reset, 0);
    }

    #[test]
    fn is_exhausted_returns_true_when_remaining_is_zero() {
        let info = RateLimitInfo {
            remaining: 0,
            reset: 0,
            limit: 5000,
        };
        assert!(info.is_exhausted());
    }

    #[test]
    fn is_low_returns_true_when_remaining_below_25_percent() {
        let info = RateLimitInfo {
            remaining: 1249,
            reset: 0,
            limit: 5000,
        };
        assert!(info.is_low());
    }

    #[test]
    fn is_low_returns_false_when_remaining_is_at_25_percent() {
        let info = RateLimitInfo {
            remaining: 1250,
            reset: 0,
            limit: 5000,
        };
        assert!(!info.is_low());
    }
}
