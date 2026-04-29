# M7-001 Inbox GraphQL Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cmd_get_inbox() -> InboxData` populate review requests and mentions from the existing GitHub GraphQL inbox query while keeping CI failures as a local SQLite aggregate.

**Architecture:** `src-tauri/src/github/graphql/mod.rs` already owns the `InboxQuery` generated bindings and `fetch_inbox()` network call. `src-tauri/src/commands/inbox.rs` should translate GraphQL search result nodes into the UI-facing `InboxItem` shape, call `fetch_inbox()` in `cmd_get_inbox`, and continue reading CI failures from cached pull rows.

**Tech Stack:** Rust, Tauri 2 commands, `graphql_client`, `reqwest`, SQLite via `rusqlite`/`r2d2`, Rust unit tests with `cargo test`.

---

## File Structure

- Modify: `src-tauri/src/commands/inbox.rs`
  - Replace REST notification-derived inbox sections with GraphQL-derived sections.
  - Add focused helpers for converting `reviewRequests.nodes` and `mentions.nodes` into `InboxItem`.
  - Keep notification REST helpers for `cmd_get_notifications`.
  - Keep `read_ci_failures()` as the local aggregation for the CI failures inbox section.
- No schema/query changes:
  - `src-tauri/src/github/graphql/queries/inbox.graphql` already contains `reviewRequests`, `mentions`, and `assignedIssues`.
  - `src-tauri/src/github/graphql/mod.rs` already exposes `fetch_inbox(client, first)`.

## Task 1: GraphQL Inbox Mapping

**Files:**
- Modify: `src-tauri/src/commands/inbox.rs`
- Test: `src-tauri/src/commands/inbox.rs`

- [x] **Step 1: Write failing tests for GraphQL node mapping**

Add these tests inside the existing `#[cfg(test)] mod tests` in `src-tauri/src/commands/inbox.rs`:

```rust
    #[test]
    fn graphql_review_request_node_maps_to_inbox_item() {
        let data = serde_json::json!({
            "reviewRequests": {
                "issueCount": 1,
                "nodes": [{
                    "__typename": "PullRequest",
                    "id": "PR_kw1",
                    "number": 42,
                    "title": "Review this",
                    "url": "https://github.com/octocat/hello/pull/42",
                    "createdAt": "2026-04-21T00:00:00Z",
                    "updatedAt": "2026-04-22T00:00:00Z",
                    "isDraft": false,
                    "state": "OPEN",
                    "repository": { "nameWithOwner": "octocat/hello" },
                    "author": {
                        "__typename": "User",
                        "login": "alice",
                        "avatarUrl": "https://example.test/a.png"
                    }
                }]
            },
            "mentions": { "issueCount": 0, "nodes": [] },
            "assignedIssues": { "issueCount": 0, "nodes": [] },
            "rateLimit": null
        });
        let parsed: crate::github::graphql::inbox_query::ResponseData =
            serde_json::from_value(data).unwrap();

        let items = review_requests_from_graphql(&parsed);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "PR_kw1");
        assert_eq!(items[0].kind, "review_requested");
        assert_eq!(items[0].repo, "octocat/hello");
        assert_eq!(items[0].number, Some(42));
        assert_eq!(items[0].title, "Review this");
        assert_eq!(
            items[0].html_url.as_deref(),
            Some("https://github.com/octocat/hello/pull/42")
        );
        assert_eq!(items[0].updated_at, "2026-04-22T00:00:00Z");
        assert!(items[0].unread);
    }

    #[test]
    fn graphql_mentions_map_issue_and_pull_request_nodes() {
        let data = serde_json::json!({
            "reviewRequests": { "issueCount": 0, "nodes": [] },
            "mentions": {
                "issueCount": 2,
                "nodes": [
                    {
                        "__typename": "Issue",
                        "id": "I_kw1",
                        "number": 7,
                        "title": "Mentioned issue",
                        "url": "https://github.com/octocat/hello/issues/7",
                        "createdAt": "2026-04-20T00:00:00Z",
                        "updatedAt": "2026-04-21T00:00:00Z",
                        "repository": { "nameWithOwner": "octocat/hello" },
                        "author": {
                            "__typename": "User",
                            "login": "bob",
                            "avatarUrl": "https://example.test/b.png"
                        }
                    },
                    {
                        "__typename": "PullRequest",
                        "id": "PR_kw2",
                        "number": 8,
                        "title": "Mentioned PR",
                        "url": "https://github.com/octocat/hello/pull/8",
                        "createdAt": "2026-04-20T00:00:00Z",
                        "updatedAt": "2026-04-22T00:00:00Z",
                        "isDraft": false,
                        "state": "OPEN",
                        "repository": { "nameWithOwner": "octocat/hello" },
                        "author": {
                            "__typename": "User",
                            "login": "carol",
                            "avatarUrl": "https://example.test/c.png"
                        }
                    }
                ]
            },
            "assignedIssues": { "issueCount": 0, "nodes": [] },
            "rateLimit": null
        });
        let parsed: crate::github::graphql::inbox_query::ResponseData =
            serde_json::from_value(data).unwrap();

        let items = mentions_from_graphql(&parsed);

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "I_kw1");
        assert_eq!(items[0].kind, "mention");
        assert_eq!(items[0].number, Some(7));
        assert_eq!(items[0].html_url.as_deref(), Some("https://github.com/octocat/hello/issues/7"));
        assert_eq!(items[1].id, "PR_kw2");
        assert_eq!(items[1].kind, "mention");
        assert_eq!(items[1].number, Some(8));
        assert_eq!(items[1].html_url.as_deref(), Some("https://github.com/octocat/hello/pull/8"));
    }
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml inbox --quiet
```

Expected: FAIL because `review_requests_from_graphql` and `mentions_from_graphql` do not exist yet.

- [x] **Step 3: Implement GraphQL mapping helpers and wire `cmd_get_inbox`**

In `src-tauri/src/commands/inbox.rs`, add this import near the existing GitHub imports:

```rust
use crate::github::graphql::{fetch_inbox, inbox_query};
```

Add these helpers near `notification_to_item`:

```rust
fn review_requests_from_graphql(data: &inbox_query::ResponseData) -> Vec<InboxItem> {
    data.review_requests
        .nodes
        .as_ref()
        .map(|nodes| {
            nodes
                .iter()
                .filter_map(|node| match node {
                    Some(inbox_query::InboxQueryReviewRequestsNodes::PullRequest(pr)) => {
                        Some(InboxItem {
                            id: pr.id.clone(),
                            kind: "review_requested".to_string(),
                            repo: pr.repository.name_with_owner.clone(),
                            number: Some(pr.number),
                            title: pr.title.clone(),
                            html_url: Some(pr.url.clone()),
                            updated_at: pr.updated_at.clone(),
                            unread: true,
                        })
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn mentions_from_graphql(data: &inbox_query::ResponseData) -> Vec<InboxItem> {
    data.mentions
        .nodes
        .as_ref()
        .map(|nodes| {
            nodes
                .iter()
                .filter_map(|node| match node {
                    Some(inbox_query::InboxQueryMentionsNodes::Issue(issue)) => Some(InboxItem {
                        id: issue.id.clone(),
                        kind: "mention".to_string(),
                        repo: issue.repository.name_with_owner.clone(),
                        number: Some(issue.number),
                        title: issue.title.clone(),
                        html_url: Some(issue.url.clone()),
                        updated_at: issue.updated_at.clone(),
                        unread: true,
                    }),
                    Some(inbox_query::InboxQueryMentionsNodes::PullRequest(pr)) => Some(InboxItem {
                        id: pr.id.clone(),
                        kind: "mention".to_string(),
                        repo: pr.repository.name_with_owner.clone(),
                        number: Some(pr.number),
                        title: pr.title.clone(),
                        html_url: Some(pr.url.clone()),
                        updated_at: pr.updated_at.clone(),
                        unread: true,
                    }),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
}
```

Replace the body of `cmd_get_inbox` with:

```rust
pub async fn cmd_get_inbox<R: Runtime>(app: AppHandle<R>) -> Result<InboxData, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;

    let inbox = fetch_inbox(&client, 50).await.map_err(|e| e.to_string())?;
    let ci_failures = read_ci_failures(pool.inner()).unwrap_or_default();

    Ok(InboxData {
        review_requests: review_requests_from_graphql(&inbox),
        ci_failures,
        mentions: mentions_from_graphql(&inbox),
    })
}
```

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml inbox --quiet
```

Expected: PASS for the inbox command tests.

- [x] **Step 5: Run Rust formatting and focused backend checks**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml graphql:: --quiet
cargo test --manifest-path src-tauri/Cargo.toml inbox --quiet
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-04-29-m7-001-inbox-graphql.md src-tauri/src/commands/inbox.rs
git commit -m "feat: M7-001 inbox commandをGraphQLに接続"
```

Expected: commit succeeds with only the plan and inbox command changes staged.

## Self-Review

- Spec coverage: The plan replaces the REST notification path in `cmd_get_inbox` with `fetch_inbox()` for review requests and mentions, and preserves local SQLite CI failure aggregation. `assignedIssues` remains queried but not surfaced because the current `InboxData` contract and inbox UI only define review requests, CI failures, and mentions.
- Placeholder scan: No placeholder implementation steps remain.
- Type consistency: The planned helper names are `review_requests_from_graphql` and `mentions_from_graphql`; tests and implementation use the same names.
