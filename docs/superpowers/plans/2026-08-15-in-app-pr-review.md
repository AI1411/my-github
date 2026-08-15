# In-app PR Review (#223) Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Submit Approve / Request changes / Comment reviews from the PR detail UI without opening the browser.

**Architecture:** One REST `POST /repos/{owner}/{repo}/pulls/{number}/reviews` via existing `GithubClient`, exposed as `cmd_submit_pull_review`. FE wires `PrFooterBar` + `CommentDraftPanel`; on success patch `dataStore.pulls[].reviewState` and emit cache refresh.

**Tech Stack:** Rust reqwest GithubClient, Tauri commands, React + vitest

## Global Constraints

- Branch: `cursor/<name>-732c`
- Prefer existing `GithubClient::post` (no octocrab)
- Keep Merge as browser-open for now (#224)
- Disable Approve/Request on own PRs; handle 403/422 with error + retry + browser fallback

---

### Task 1: REST create review + cache update + command

**Files:**
- Modify: `src-tauri/src/github/rest.rs`
- Modify: `src-tauri/src/cache/pulls.rs`
- Modify: `src-tauri/src/commands/pulls.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] Add `create_pull_request_review`
- [ ] Add `update_pull_review_state`
- [ ] Add `cmd_submit_pull_review`
- [ ] Unit tests for event mapping / cache update
- [ ] Commit

### Task 2: Wire FE footer + comment submit

**Files:**
- Modify: `src/components/pulls/PrFooterBar.tsx`
- Modify: `src/components/pulls/CommentDraftPanel.tsx`
- Modify: `src/pages/PullDetailPage.tsx`
- Modify: tests

- [ ] Invoke command with loading/error/retry
- [ ] Patch reviewState on success
- [ ] Vitest coverage
- [ ] Commit / PR / merge
