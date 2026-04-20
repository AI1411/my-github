# GitHub Client Implementation Plan (M3-001/002/003)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src-tauri/src/github/client.rs` に reqwest ベースの GitHub HTTP クライアントを実装する。User-Agent 設定・Authorization ヘッダ自動付与・レート制限パーサを含む。

**Architecture:** `GithubClient` struct が `reqwest::Client` と token を保持し、全リクエストに対して User-Agent と Authorization ヘッダを自動付与する。レスポンスヘッダから `X-RateLimit-Remaining` / `X-RateLimit-Reset` を抽出する `RateLimitInfo` を持つ。

**Tech Stack:** Rust, reqwest 0.12, thiserror 2, serde

**Branch:** `issue-36` (covers issues #36, #37, #38)

---

### Task 1: `src-tauri/src/github/` モジュール作成 + GithubClient 基本構造 (Issue #36)

**Files:**
- Create: `src-tauri/src/github/mod.rs`
- Create: `src-tauri/src/github/client.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b issue-36
```

- [ ] **Step 2: `client.rs` に failing test を書く**

`src-tauri/src/github/client.rs` を作成:

```rust
use reqwest::Client;
use thiserror::Error;

const USER_AGENT: &str = "pulse-app/0.1";
const GITHUB_API_BASE: &str = "https://api.github.com";

#[derive(Debug, Error)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("GitHub API error (HTTP {status}): {message}")]
    Api { status: u16, message: String },
}

#[derive(Debug, Clone)]
pub struct GithubClient {
    inner: Client,
    token: String,
}

impl GithubClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            inner: Client::new(),
            token: token.into(),
        }
    }

    pub fn base_url() -> &'static str {
        GITHUB_API_BASE
    }

    pub fn user_agent() -> &'static str {
        USER_AGENT
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
    fn user_agent_contains_pulse() {
        assert!(GithubClient::user_agent().contains("pulse"));
    }
}
```

- [ ] **Step 3: `mod.rs` を作成する**

`src-tauri/src/github/mod.rs` を作成:

```rust
pub mod client;
```

- [ ] **Step 4: `lib.rs` に `github` モジュールを登録する**

`src-tauri/src/lib.rs` を修正（既存の `pub mod auth;` の後に追加）:

```rust
pub mod auth;
pub mod commands;
pub mod config;
pub mod github;
```

- [ ] **Step 5: テストを実行して PASS を確認する**

```bash
cargo test github::client -- --nocapture
```

期待結果: 3テストが PASS

- [ ] **Step 6: lint チェック**

```bash
cargo clippy -- -D warnings
```

期待結果: warning なし

- [ ] **Step 7: コミット**

```bash
git add src-tauri/src/github/ src-tauri/src/lib.rs
git commit -m "feat(m3-001): add GithubClient struct with User-Agent setting"
```

---

### Task 2: Authorization ヘッダ自動付与メソッド (Issue #37)

**Files:**
- Modify: `src-tauri/src/github/client.rs`

- [ ] **Step 1: failing test を追加する**

`client.rs` の `#[cfg(test)]` ブロックに以下のテストを追加:

```rust
#[test]
fn get_builds_request_with_auth_header() {
    let client = GithubClient::new("gho_mytoken");
    let req = client
        .get("/user")
        .build()
        .unwrap();
    let auth = req.headers().get("Authorization").unwrap().to_str().unwrap();
    assert_eq!(auth, "Bearer gho_mytoken");
    let ua = req.headers().get("User-Agent").unwrap().to_str().unwrap();
    assert_eq!(ua, "pulse-app/0.1");
    let accept = req.headers().get("Accept").unwrap().to_str().unwrap();
    assert_eq!(accept, "application/vnd.github+json");
}
```

- [ ] **Step 2: テストが FAIL することを確認する**

```bash
cargo test github::client::tests::get_builds_request_with_auth_header 2>&1 | tail -5
```

期待結果: `error[E0599]: no method named 'get' found for struct 'GithubClient'`

- [ ] **Step 3: `get` メソッドを実装する**

`client.rs` の `impl GithubClient` に以下を追加:

```rust
pub fn get(&self, path: &str) -> reqwest::RequestBuilder {
    let url = format!("{}{}", GITHUB_API_BASE, path);
    self.inner
        .get(url)
        .header("Authorization", format!("Bearer {}", self.token))
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
}
```

- [ ] **Step 4: テストを実行して PASS を確認する**

```bash
cargo test github::client -- --nocapture
```

期待結果: 全テスト PASS

- [ ] **Step 5: lint チェック**

```bash
cargo clippy -- -D warnings
```

- [ ] **Step 6: コミット**

```bash
git add src-tauri/src/github/client.rs
git commit -m "feat(m3-002): add Authorization header auto-attach via get() method"
```

---

### Task 3: レート制限パーサ (Issue #38)

**Files:**
- Modify: `src-tauri/src/github/client.rs`

- [ ] **Step 1: failing test を追加する**

`client.rs` の `#[cfg(test)]` ブロックに以下を追加:

```rust
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
    use std::str::FromStr;
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
```

- [ ] **Step 2: テストが FAIL することを確認する**

```bash
cargo test github::client::tests::rate_limit 2>&1 | tail -5
```

期待結果: `error[E0412]: cannot find type 'RateLimitInfo'`

- [ ] **Step 3: `RateLimitInfo` 構造体と `from_headers` を実装する**

`client.rs` の `GithubClient` 定義の直前に追加:

```rust
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
```

- [ ] **Step 4: テストを実行して PASS を確認する**

```bash
cargo test github::client -- --nocapture
```

期待結果: 全 6 テスト PASS

- [ ] **Step 5: lint チェック**

```bash
cargo clippy -- -D warnings
```

- [ ] **Step 6: コミット**

```bash
git add src-tauri/src/github/client.rs
git commit -m "feat(m3-003): add RateLimitInfo with X-RateLimit header parser"
```

---

### Task 4: PR 作成 + Issue クローズ

- [ ] **Step 1: PR を作成する**

```bash
git push -u origin issue-36
gh pr create \
  --title "feat(m3-001/002/003): GitHub HTTP client with auth and rate limit" \
  --body "Closes #36, Closes #37, Closes #38" \
  --base main
```

- [ ] **Step 2: docs/tasks.md の M3-001/002/003 にチェックを入れる**

`docs/tasks.md` 内の以下 3 行を更新:
- `- [ ] M3-001` → `- [x] M3-001`
- `- [ ] M3-002` → `- [x] M3-002`
- `- [ ] M3-003` → `- [x] M3-003`

- [ ] **Step 3: プランファイルを削除してコミットする**

```bash
rm docs/superpowers/plans/2026-04-20-github-client.md
git add docs/tasks.md docs/superpowers/plans/
git commit -m "chore: mark M3-001/002/003 complete and remove plan file"
git push
```
