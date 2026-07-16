use thiserror::Error;

const USER_AGENT: &str = "my-github/0.1";
const GITHUB_API_BASE: &str = "https://api.github.com";

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
}

impl RateLimitInfo {
    pub fn from_headers(headers: &reqwest::header::HeaderMap) -> Self {
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
        Self { remaining, reset }
    }

    pub fn is_exhausted(&self) -> bool {
        self.remaining == 0
    }

    pub fn is_low(&self) -> bool {
        self.remaining < 100
    }
}

#[derive(Debug, Clone)]
pub struct GithubClient {
    inner: reqwest::Client,
    token: String,
}

impl GithubClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            inner: reqwest::Client::new(),
            token: token.into(),
        }
    }

    pub fn base_url() -> &'static str {
        GITHUB_API_BASE
    }

    pub fn user_agent() -> &'static str {
        USER_AGENT
    }

    pub fn get(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", GITHUB_API_BASE, path);
        self.inner
            .get(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }

    pub fn post(&self, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", GITHUB_API_BASE, path);
        self.inner
            .post(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_stores_token() {
        let client = GithubClient::new("gho_test123");
        assert_eq!(client.token, "gho_test123");
    }

    #[test]
    fn base_url_is_github_api() {
        assert_eq!(GithubClient::base_url(), "https://api.github.com");
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
        };
        assert_eq!(info.remaining, 42);
        assert_eq!(info.reset, 1700000000);
    }

    #[test]
    fn parse_rate_limit_parses_valid_headers() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "x-ratelimit-remaining",
            reqwest::header::HeaderValue::from_str("58").unwrap(),
        );
        headers.insert(
            "x-ratelimit-reset",
            reqwest::header::HeaderValue::from_str("1700000000").unwrap(),
        );
        let info = RateLimitInfo::from_headers(&headers);
        assert_eq!(info.remaining, 58);
        assert_eq!(info.reset, 1700000000);
    }

    #[test]
    fn parse_rate_limit_defaults_when_headers_missing() {
        let headers = reqwest::header::HeaderMap::new();
        let info = RateLimitInfo::from_headers(&headers);
        assert_eq!(info.remaining, u32::MAX);
        assert_eq!(info.reset, 0);
    }

    #[test]
    fn is_exhausted_returns_true_when_remaining_is_zero() {
        let info = RateLimitInfo {
            remaining: 0,
            reset: 0,
        };
        assert!(info.is_exhausted());
    }

    #[test]
    fn is_low_returns_true_when_remaining_below_100() {
        let info = RateLimitInfo {
            remaining: 99,
            reset: 0,
        };
        assert!(info.is_low());
    }

    #[test]
    fn is_low_returns_false_when_remaining_is_100() {
        let info = RateLimitInfo {
            remaining: 100,
            reset: 0,
        };
        assert!(!info.is_low());
    }
}
