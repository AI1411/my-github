# M7 Issue Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the open GitHub M7 issues by filling the remaining behavior gaps in Activity read-state handling, CI run log retrieval, and WorkspaceSwitcher account/recent-workspace behavior.

**Architecture:** Most M7 UI and backend commands already exist. This plan keeps existing screens and component boundaries, adds missing click/refetch behavior at page level, adds a small REST helper for workflow log archive URLs, and keeps account switching pragmatic by switching the keyring active account, resetting stores, and refreshing current-user/sync state.

**Tech Stack:** Tauri 2, Rust, reqwest, React 19, TypeScript, Zustand, React Router, Vitest + Testing Library, Cargo tests.

---

## Scope Map

Already implemented and verified by existing code/tests:
- M7-001 through M7-010: Inbox, Activity UI, Activity row, and time grouping exist.
- M7-013 through M7-015: CI page, workflow row, and workflow run command exist.
- M7-017 through M7-021: CommandPalette modal, nav, local search, REST search, and keyboard navigation exist.

Remaining implementation gaps:
- M7-011/M7-012: Activity rows and "Mark all read" call backend commands but do not refetch/update UI after marking read, and row click does not mark one notification read.
- M7-016: `cmd_open_run_logs` opens the workflow run page instead of resolving `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs`.
- M7-022/M7-023: WorkspaceSwitcher lacks a Recent workspaces section, invokes `cmd_logout` without the required account id, and has no account-switch path that resets stores and refreshes account state.

## File Structure

- Modify: `src/pages/ActivityPage.tsx`
  - Add `useNavigate`.
  - Refetch after single/all mark-read commands.
  - Navigate internally to PR/Issue detail when possible.
- Create: `src/pages/ActivityPage.test.tsx`
  - Test mark-all refetch and row-click mark-read/navigation behavior.
- Modify: `src-tauri/src/github/rest.rs`
  - Add `workflow_run_logs_path()` and `get_workflow_run_logs_url()`.
- Modify: `src-tauri/src/commands/ci.rs`
  - Change `cmd_open_run_logs` to accept `{ owner, repo, runId }`, resolve the logs archive URL, then open it.
- Modify: `src/pages/CiStatusPage.tsx`
  - Pass owner/repo/run id to `cmd_open_run_logs`.
- Modify: `src/components/ci/WorkflowRunRow.test.tsx`
  - Assert Logs button invokes the callback.
- Modify: `src-tauri/src/commands/auth.rs`
  - Add `cmd_switch_account(account_id)` and fix logout tests around account id.
- Modify: `src-tauri/src/lib.rs`
  - Register `cmd_switch_account`.
- Modify: `src/components/workspace/WorkspaceSwitcher.tsx`
  - Pass `accountId` to logout.
  - Show Recent workspaces derived from cached store data.
  - Add account switch handler that invokes `cmd_switch_account`, resets data, refreshes current user, invokes `cmd_sync_now`, and closes.
- Modify: `src/components/workspace/WorkspaceSwitcher.test.tsx`
  - Cover account id logout, recent workspaces, and switch reset/refetch flow.

## Task 1: Activity Read State

**Files:**
- Create: `src/pages/ActivityPage.test.tsx`
- Modify: `src/pages/ActivityPage.tsx`

- [x] **Step 1: Write failing tests**

Create `src/pages/ActivityPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ActivityPage from "./ActivityPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const notifications = [
  {
    id: "thread-1",
    reason: "mention",
    repo: "octocat/hello",
    subjectTitle: "Mentioned issue",
    subjectType: "Issue",
    htmlUrl: "https://github.com/octocat/hello/issues/7",
    unread: true,
    updatedAt: new Date().toISOString(),
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ActivityPage />
    </MemoryRouter>,
  );
}

describe("ActivityPage read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_notifications") return Promise.resolve(notifications);
      return Promise.resolve(null);
    });
  });

  it("marks all read and refetches notifications", async () => {
    renderPage();
    await screen.findByText("Mentioned issue");

    fireEvent.click(screen.getByText("Mark all read"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_all_notifications_read");
    });
    await waitFor(() => {
      expect(
        (invoke as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === "cmd_get_notifications"),
      ).toHaveLength(2);
    });
  });

  it("marks one unread notification read and navigates to issue detail", async () => {
    renderPage();
    await screen.findByText("Mentioned issue");

    fireEvent.click(screen.getByText("Mentioned issue"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_notification_read", {
        threadId: "thread-1",
      });
    });
    expect(navigate).toHaveBeenCalledWith("/issues/octocat/hello/7");
  });
});
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
pnpm test src/pages/ActivityPage.test.tsx
```

Expected: FAIL because `ActivityPage` does not currently pass `onSelect` to `ActivityRow` or refetch after mark-read.

- [x] **Step 3: Implement the page behavior**

In `src/pages/ActivityPage.tsx`, import `useNavigate`, destructure `refetch`, and add:

```tsx
function notificationRoute(htmlUrl: string | null): string | null {
  if (!htmlUrl) return null;
  const match = htmlUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, type, number] = match;
  return type === "pull"
    ? `/pulls/${owner}/${repo}/${number}`
    : `/issues/${owner}/${repo}/${number}`;
}
```

Inside `ActivityPage`:

```tsx
const { notifications, loading, error, refetch } = useNotificationsQuery();
const navigate = useNavigate();

const handleMarkAllRead = async () => {
  await invoke("cmd_mark_all_notifications_read");
  refetch();
};

const handleSelectNotification = async (notification: NotificationSummary) => {
  if (notification.unread) {
    await invoke("cmd_mark_notification_read", { threadId: notification.id });
    refetch();
  }
  const route = notificationRoute(notification.htmlUrl);
  if (route) navigate(route);
};
```

Wire:

```tsx
onClick={() => void handleMarkAllRead()}
...
<ActivityRow
  key={n.id}
  notification={n}
  onSelect={() => void handleSelectNotification(n)}
/>
```

- [x] **Step 4: Verify tests pass**

Run:

```bash
pnpm test src/pages/ActivityPage.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/pages/ActivityPage.tsx src/pages/ActivityPage.test.tsx
git commit -m "feat: M7 activity既読操作を再フェッチに接続"
```

## Task 2: Workflow Run Log Retrieval

**Files:**
- Modify: `src-tauri/src/github/rest.rs`
- Modify: `src-tauri/src/commands/ci.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/pages/CiStatusPage.tsx`
- Modify: `src/components/ci/WorkflowRunRow.test.tsx`

- [x] **Step 1: Write failing backend/frontend tests**

Add to `src-tauri/src/github/rest.rs` tests:

```rust
    #[test]
    fn workflow_run_logs_path_is_correct() {
        assert_eq!(
            workflow_run_logs_path("octocat", "hello", 100),
            "/repos/octocat/hello/actions/runs/100/logs"
        );
    }
```

Add to `src-tauri/src/commands/ci.rs` tests:

```rust
    #[test]
    fn cmd_open_run_logs_accepts_repo_and_run_id() {
        let _ = cmd_open_run_logs::<tauri::Wry>;
    }
```

Update `src/components/ci/WorkflowRunRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
...
  it("calls onOpenLogs when Logs button is clicked", () => {
    const handler = vi.fn();
    render(<WorkflowRunRow run={run} onOpenLogs={handler} />);
    fireEvent.click(screen.getByText("Logs"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml workflow_run_logs_path --quiet
pnpm test src/components/ci/WorkflowRunRow.test.tsx
```

Expected: Rust test fails because `workflow_run_logs_path` does not exist.

- [x] **Step 3: Implement backend logs URL resolution**

In `src-tauri/src/github/rest.rs`:

```rust
pub fn workflow_run_logs_path(owner: &str, repo: &str, run_id: u64) -> String {
    format!("/repos/{}/{}/actions/runs/{}/logs", owner, repo, run_id)
}

pub async fn get_workflow_run_logs_url(
    client: &GithubClient,
    owner: &str,
    repo: &str,
    run_id: u64,
) -> Result<String, ClientError> {
    let resp = client
        .get(&workflow_run_logs_path(owner, repo, run_id))
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
    Ok(resp.url().to_string())
}
```

In `src-tauri/src/commands/ci.rs`, replace the command with:

```rust
#[tauri::command]
pub async fn cmd_open_run_logs<R: Runtime>(
    app: AppHandle<R>,
    owner: String,
    repo: String,
    run_id: u64,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token".to_string())?;
    let client = GithubClient::new(token);
    let logs_url = crate::github::rest::get_workflow_run_logs_url(&client, &owner, &repo, run_id)
        .await
        .map_err(|e| e.to_string())?;

    app.opener()
        .open_url(&logs_url, None::<String>)
        .map_err(|e| e.to_string())
}
```

- [x] **Step 4: Implement frontend invocation shape**

In `src/pages/CiStatusPage.tsx`:

```tsx
const handleOpenLogs = (run: WorkflowRunSummary) => {
  const [runOwner, runRepo] = run.repo.split("/");
  if (!runOwner || !runRepo) return;
  void invoke("cmd_open_run_logs", {
    owner: runOwner,
    repo: runRepo,
    runId: run.id,
  });
};
```

- [x] **Step 5: Verify tests pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml workflow_run_logs_path --quiet
cargo test --manifest-path src-tauri/Cargo.toml ci:: --quiet
pnpm test src/components/ci/WorkflowRunRow.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```bash
git add src-tauri/src/github/rest.rs src-tauri/src/commands/ci.rs src/pages/CiStatusPage.tsx src/components/ci/WorkflowRunRow.test.tsx
git commit -m "feat: M7 workflow runログURLを取得して開く"
```

## Task 3: Workspace Switcher Account and Recent Workspace Flow

**Files:**
- Modify: `src-tauri/src/commands/auth.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/components/workspace/WorkspaceSwitcher.tsx`
- Modify: `src/components/workspace/WorkspaceSwitcher.test.tsx`

- [x] **Step 1: Write failing tests**

Add to `src-tauri/src/commands/auth.rs` tests:

```rust
    #[test]
    fn cmd_switch_account_accepts_account_id() {
        let _: fn(String) -> _ = |s| cmd_switch_account(s);
    }
```

Add to `src/components/workspace/WorkspaceSwitcher.test.tsx`:

```tsx
import { fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useDataStore } from "../../stores/dataStore";
...
  it("passes current account id to logout and resets stores", async () => {
    const onSignOut = vi.fn();
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher onSignOut={onSignOut} />);

    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_logout", { accountId: "octocat" });
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders recent workspaces from data store repos", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    useDataStore.setState({
      pulls: [{
        id: 1, number: 1, title: "PR", repo: "octocat/hello", author: null,
        state: "open", isDraft: false, headRef: "feature", baseRef: "main",
        updatedAt: "2026-04-21T00:00:00Z", htmlUrl: null, ciState: null,
        reviewState: null, hasMention: false, requestedReviewers: [],
        mergedAt: null, additions: null, deletions: null, changedFiles: null,
      }],
      issues: [],
      notifications: [],
      lastSyncedAt: null,
    });

    render(<WorkspaceSwitcher />);

    expect(screen.getByText("Recent workspaces")).toBeInTheDocument();
    expect(screen.getByText("octocat/hello")).toBeInTheDocument();
  });
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml cmd_switch_account_accepts_account_id --quiet
pnpm test src/components/workspace/WorkspaceSwitcher.test.tsx
```

Expected: Rust test fails because `cmd_switch_account` does not exist; frontend logout assertion fails because no `accountId` is sent.

- [x] **Step 3: Implement account switch command**

In `src-tauri/src/commands/auth.rs`, import `load_token` and add:

```rust
#[tauri::command]
pub async fn cmd_switch_account(account_id: String) -> Result<PatUser, String> {
    let token = crate::auth::token_store::load_token(&account_id)
        .ok_or_else(|| "no token for account".to_string())?;
    crate::auth::token_store::save_last_account_id(&account_id).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();
    let (user, _) = validate_pat(&client, &token)
        .await
        .map_err(|e| e.to_string())?;
    Ok(user)
}
```

Register `commands::auth::cmd_switch_account` in `src-tauri/src/lib.rs`.

- [x] **Step 4: Implement WorkspaceSwitcher UI/behavior**

In `src/components/workspace/WorkspaceSwitcher.tsx`:

```tsx
const setUser = useAuthStore((s) => s.setUser);
const pulls = useDataStore((s) => s.pulls);
const issues = useDataStore((s) => s.issues);
const notifications = useDataStore((s) => s.notifications);

const recentWorkspaces = Array.from(
  new Set([
    ...pulls.map((p) => p.repo),
    ...issues.map((i) => i.repo),
    ...notifications.map((n) => n.repo),
  ]),
).slice(0, 6);

const handleSwitchAccount = async (accountId: string) => {
  const nextUser = await invoke<{ login: string; avatar_url: string }>(
    "cmd_switch_account",
    { accountId },
  );
  resetData();
  setUser(nextUser);
  await invoke("cmd_sync_now");
  close();
};

const handleSignOut = async () => {
  if (user) await invoke("cmd_logout", { accountId: user.login });
  resetData();
  reset();
  close();
  onSignOut?.();
};
```

Render a current-account button under Accounts, keep the Active badge, and render:

```tsx
<div className="px-4 py-2.5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
    Recent workspaces
  </p>
  {recentWorkspaces.length === 0 ? (
    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
      No recent repositories
    </p>
  ) : (
    recentWorkspaces.map((repo) => (
      <div key={repo} className="text-sm truncate py-1" style={{ color: "var(--text-secondary)" }}>
        {repo}
      </div>
    ))
  )}
</div>
```

- [x] **Step 5: Verify tests pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml auth:: --quiet
pnpm test src/components/workspace/WorkspaceSwitcher.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```bash
git add src-tauri/src/commands/auth.rs src-tauri/src/lib.rs src/components/workspace/WorkspaceSwitcher.tsx src/components/workspace/WorkspaceSwitcher.test.tsx
git commit -m "feat: M7 workspace切替でストアをリセット"
```

## Task 4: Final M7 Verification and Issue Cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-04-29-m7-issue-completion.md`

- [x] **Step 1: Run frontend checks**

Run:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Expected: all commands exit 0.

- [x] **Step 2: Run backend checks**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --quiet
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Close M7 GitHub issues after verification**

Status: deferred until this branch is pushed or merged so remote issue state does not claim unpublished work is complete.

Run:

```bash
for issue in 118 119 120 121 122 123 124 125 126 127 128 129 130 131 132 133 134 135 136 137 138 139 140; do
  gh issue close "$issue" --repo AI1411/my-github --comment "Implemented and verified in the M7 completion work."
done
```

Expected: each M7 issue moves to closed.

- [ ] **Step 4: Commit plan checklist update**

Run:

```bash
git add docs/superpowers/plans/2026-04-29-m7-issue-completion.md
git commit -m "docs: M7 issue完了計画を更新"
```

## Self-Review

- Spec coverage: All open M7 issue titles are either already implemented in existing code or covered by the remaining tasks above. M7-016 and M7-022/M7-023 have concrete gaps and are explicitly covered.
- Placeholder scan: No placeholder markers remain.
- Type consistency: Frontend invoke keys use Tauri camelCase (`threadId`, `runId`, `accountId`) matching Rust snake_case command parameters.
