//! Host / API base URL helpers for github.com and GHES.
//!
//! Frontend stores `accountHosts` and passes an optional API `base_url` into
//! `cmd_save_pat`. The token store persists that API base per login so
//! [`crate::github::client::GithubClient::with_base_url`] can route requests
//! when callers load it.
//!
//! Not every command path is migrated yet — prefer `with_base_url` + stored
//! host when constructing clients for the active account.

pub const DEFAULT_API_BASE: &str = "https://api.github.com";

fn strip_trailing_slashes(s: &str) -> &str {
    s.trim_end_matches('/')
}

/// Very small URL split: scheme://host[/path…]
fn split_host_path(input: &str) -> Option<(String, String, String)> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }
    let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let (scheme, rest) = if let Some(r) = with_scheme.strip_prefix("https://") {
        ("https", r)
    } else {
        let r = with_scheme.strip_prefix("http://")?;
        ("http", r)
    };
    let (host_port, path) = match rest.split_once('/') {
        Some((h, p)) => (h, format!("/{p}")),
        None => (rest, String::new()),
    };
    if host_port.is_empty() {
        return None;
    }
    Some((scheme.to_string(), host_port.to_string(), path))
}

/// Normalize a user/host URL into a REST API base (no trailing slash).
///
/// - github.com → `https://api.github.com`
/// - `https://github.example.com` → `https://github.example.com/api/v3`
pub fn normalize_api_base_url(input: &str) -> String {
    let Some((scheme, host_port, path)) = split_host_path(input) else {
        return DEFAULT_API_BASE.to_string();
    };

    let host = host_port
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if host == "github.com" || host == "www.github.com" || host == "api.github.com" {
        return DEFAULT_API_BASE.to_string();
    }

    let path = strip_trailing_slashes(&path);
    if path == "/api/v3" || path.ends_with("/api/v3") {
        return format!("{scheme}://{host_port}{path}");
    }

    format!("{scheme}://{host_port}/api/v3")
}

/// Hostname label for SQLite `accounts.host` (e.g. `github.com`).
pub fn host_label_from_api_base(api_base: &str) -> String {
    if api_base == DEFAULT_API_BASE || api_base.is_empty() {
        return "github.com".to_string();
    }
    let Some((_, host_port, _)) = split_host_path(api_base) else {
        return "github.com".to_string();
    };
    host_port
        .split(':')
        .next()
        .unwrap_or("github.com")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_github_com() {
        assert_eq!(normalize_api_base_url(""), DEFAULT_API_BASE);
        assert_eq!(normalize_api_base_url("github.com"), DEFAULT_API_BASE);
        assert_eq!(
            normalize_api_base_url("https://github.com"),
            DEFAULT_API_BASE
        );
    }

    #[test]
    fn normalize_ghes_web_to_api_v3() {
        assert_eq!(
            normalize_api_base_url("https://github.example.com"),
            "https://github.example.com/api/v3"
        );
        assert_eq!(
            normalize_api_base_url("github.example.com"),
            "https://github.example.com/api/v3"
        );
        assert_eq!(
            normalize_api_base_url("https://github.example.com/api/v3/"),
            "https://github.example.com/api/v3"
        );
    }

    #[test]
    fn host_label() {
        assert_eq!(host_label_from_api_base(DEFAULT_API_BASE), "github.com");
        assert_eq!(
            host_label_from_api_base("https://github.example.com/api/v3"),
            "github.example.com"
        );
    }
}
