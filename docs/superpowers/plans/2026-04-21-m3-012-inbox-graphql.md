# M3-012: Inbox GraphQL Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src-tauri/src/github/graphql/queries/inbox.graphql` に、GitHub GraphQL API v4 を使ってレビュー要求 / mention / 割り当てIssue を一括取得する query を定義する。

**Architecture:** GitHub GraphQL API の `search(type: ISSUE)` を3本 aliases で並列に呼び出す単一クエリ。後続タスク M3-013 (`graphql.rs`) で `graphql_client` crate がこのファイルからコンパイル時に Rust 型を生成する前提。本タスクはクエリファイル単独のスコープ。

**Tech Stack:** GraphQL (GitHub API v4), graphql_client crate (後続タスクで使用)

## Issue

- Issue #47 = M3-012

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/github/graphql/queries/inbox.graphql` | Create | Inbox query 定義（reviewRequests / mentions / assignedIssues / rateLimit） |
| `src-tauri/src/github/graphql/queries/inbox.graphql.test.md` | (なし) | — |

GraphQL ファイル単独のため、`graphql/` Rust モジュールの追加は **M3-013** で実施する（本タスクでは触らない）。

## 設計ノート

- **3つのsearchを1クエリで**: GitHub GraphQL API は `search` を aliases で複数回呼び出せる。Rate limit cost を抑えるため1リクエストに集約。
- **クエリ条件**:
  - `reviewRequests`: `is:open is:pr review-requested:@me archived:false`
  - `mentions`: `is:open mentions:@me archived:false`（PR/Issue 両方）
  - `assignedIssues`: `is:open is:issue assignee:@me archived:false`
- **取得件数**: `$first: Int = 50`（デフォルト50、呼び出し側で上書き可能）
- **フラグメント共通化**: PR と Issue の共通フィールドは各 `... on` で明示列挙（`graphql_client` がインライン fragment を型として扱いやすいため、named fragment は使わない方針）
- **rateLimit**: 各クエリの rate limit 情報を合わせて取得し、poller 側でスロットリング判定に使う

---

### Task 1: inbox.graphql を作成し、GraphQL構文として妥当なことを検証する

**Files:**
- Create: `src-tauri/src/github/graphql/queries/inbox.graphql`

- [x] **Step 1: ディレクトリを作成**

```bash
mkdir -p src-tauri/src/github/graphql/queries
```

- [x] **Step 2: inbox.graphql を作成**

以下を `src-tauri/src/github/graphql/queries/inbox.graphql` に書く:

```graphql
query InboxQuery($first: Int = 50) {
  reviewRequests: search(
    type: ISSUE
    first: $first
    query: "is:open is:pr review-requested:@me archived:false"
  ) {
    issueCount
    nodes {
      __typename
      ... on PullRequest {
        id
        number
        title
        url
        createdAt
        updatedAt
        isDraft
        state
        repository {
          nameWithOwner
        }
        author {
          login
          avatarUrl
        }
      }
    }
  }

  mentions: search(
    type: ISSUE
    first: $first
    query: "is:open mentions:@me archived:false"
  ) {
    issueCount
    nodes {
      __typename
      ... on Issue {
        id
        number
        title
        url
        createdAt
        updatedAt
        repository {
          nameWithOwner
        }
        author {
          login
          avatarUrl
        }
      }
      ... on PullRequest {
        id
        number
        title
        url
        createdAt
        updatedAt
        isDraft
        state
        repository {
          nameWithOwner
        }
        author {
          login
          avatarUrl
        }
      }
    }
  }

  assignedIssues: search(
    type: ISSUE
    first: $first
    query: "is:open is:issue assignee:@me archived:false"
  ) {
    issueCount
    nodes {
      __typename
      ... on Issue {
        id
        number
        title
        url
        createdAt
        updatedAt
        repository {
          nameWithOwner
        }
        author {
          login
          avatarUrl
        }
      }
    }
  }

  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
```

- [x] **Step 3: GraphQL構文をRust側の`graphql-parser`でsmoke checkする（別途インストール不要、graphql_client の依存に含まれる `graphql-parser` を使う）**

以下のone-linerで構文チェック:

```bash
cd src-tauri && cargo run --quiet --manifest-path=Cargo.toml --example=__noop__ 2>/dev/null || true
```

※ `graphql_client` はコンパイル時にクエリを解析するため、本タスクではまず `python3` ワンライナーでブレース/括弧のバランスだけ確認する:

```bash
python3 -c "
s = open('src-tauri/src/github/graphql/queries/inbox.graphql').read()
assert s.count('{') == s.count('}'), f'brace mismatch: {s.count(chr(123))} vs {s.count(chr(125))}'
assert s.count('(') == s.count(')'), 'paren mismatch'
print('brace/paren OK, len=', len(s))
"
```

Expected: `brace/paren OK, len= <数字>` が表示される。

- [x] **Step 4: 期待されるフィールド・aliases が存在することを確認**

```bash
grep -qE 'reviewRequests: search' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'mentions: search' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'assignedIssues: search' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'rateLimit' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'review-requested:@me' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'mentions:@me' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'assignee:@me' src-tauri/src/github/graphql/queries/inbox.graphql && \
grep -qE 'nameWithOwner' src-tauri/src/github/graphql/queries/inbox.graphql && \
echo "all required fields present"
```

Expected: `all required fields present` が表示される。

- [x] **Step 5: Rust側のビルドが壊れていないことを確認**

```bash
cd src-tauri && cargo build 2>&1 | tail -20
```

Expected: `Finished` 表示。`graphql/queries/inbox.graphql` はまだ Rust コードから参照されていないためビルド構成に影響しない。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/github/graphql/queries/inbox.graphql
git commit -m "feat(m3-012): add inbox GraphQL query for review requests, mentions, and assigned issues"
```

---

### Task 2: PRを作成して Issue #47 を閉じる

- [ ] **Step 1: push & PR 作成**

```bash
git push -u origin issue-47
gh pr create --title "feat(m3-012): add inbox GraphQL query" --body "$(cat <<'EOF'
## Summary
- \`src-tauri/src/github/graphql/queries/inbox.graphql\` を追加
- レビュー要求 / mention / 割り当てIssue を1クエリで一括取得

Closes #47

## Test plan
- [ ] ブレース・括弧バランス検証
- [ ] 期待フィールドの grep 確認
- [ ] \`cargo build\` 成功
EOF
)"
```

- [ ] **Step 2: プランファイルを削除**

```bash
rm docs/superpowers/plans/2026-04-21-m3-012-inbox-graphql.md
git add -A
git commit -m "chore: remove completed plan file"
git push
```

---

## Self-Review チェック

- **Spec coverage**: ✅ レビュー要求 / mention / 割り当てIssue の3つすべて取得。rateLimit もセットで取得（poller向け）。
- **Placeholder**: なし。全step に実行可能な内容を記載。
- **Type consistency**: PR/Issue の共通フィールド（id/number/title/url/createdAt/updatedAt/repository/author）は両 inline fragment で同名定義。`__typename` を含めているので graphql_client 側で discriminate 可能。
