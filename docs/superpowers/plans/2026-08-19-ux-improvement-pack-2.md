# UX Improvement Pack 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship GitHub issues #492–#505 (tracked by #506) one issue per PR, merge to `main` before starting the next.

**Architecture:** Prefer thin REST helpers + Tauri commands + existing React patterns (`useSettingsShortcut`, `FileDiff`/`DiffLineRow`, Settings store). No new crates unless unavoidable. Client-side pending review drafts live in React state until submit.

**Tech Stack:** Tauri 2 / Rust commands, React 19 + Zustand, Vitest + Testing Library, `cargo test --lib`.

## Global Constraints

- Branch: `cursor/<issue>-<slug>-a3c2` from latest `origin/main` after each merge
- Close issue via PR body `close #N` (PULL_REQUEST_TEMPLATE)
- Merge each PR before starting the next issue (`gh pr merge` — user-mandated)
- Create/update PRs with ManagePullRequest (not `gh pr create`)
- Keep MVPs scoped to acceptance criteria only
- TDD where practical: failing test → implement → green → commit → push → PR → merge
- Do **not** implement: Projects/Discussions full sync, LLM summary enhancement, light theme overhaul, GHES GraphQL full parity

**Execution order (from #506):**

1. #492 → #493 → #494 → #495
2. #496
3. #502
4. #497 → #498 → #499 → #500 → #501 → #503 → #504 → #505
5. Close #506 when children are done

---

## File Structure (cross-cutting)

| Area | Primary files |
|------|----------------|
| Review REST | `src-tauri/src/github/rest.rs` (`CreateReviewBody`, new comment fields) |
| Review cmds | `src-tauri/src/commands/pulls.rs`, `src-tauri/src/commands/ci.rs`, `src-tauri/src/lib.rs` |
| Diff UI | `src/components/pulls/diff/DiffLineRow.tsx`, `FileDiff.tsx`, `PullDetailPage.tsx` |
| Shortcuts | `src/stores/settingsStore.ts`, `GlobalShortcuts.tsx` / page hooks |
| Notifications | `src-tauri/src/commands/inbox.rs`, `rest.rs` |
| Auth UX | `src/pages/components/PATTab.tsx` |
| Nav | `Sidebar.tsx`, `CommandPalette.tsx` |
| Docs/DX | `README.md`, `package.json`, `vite`/`vitest` setup, `tauri.conf.json` |

---

### Task 1: #492 Diff line comments + pending review submit

**Files:**
- Modify: `src-tauri/src/github/rest.rs` — extend `CreateReviewBody` with `commit_id`, `comments: Vec<ReviewCommentInput>`
- Modify: `src-tauri/src/commands/pulls.rs` — `cmd_submit_pull_review` accepts optional `comments` + `commitId`; or add `cmd_submit_pull_review_with_comments`
- Modify: `src/components/pulls/diff/DiffLineRow.tsx` — clickable gutter / “+” to start comment
- Modify: `src/components/pulls/FileDiff.tsx` — draft composer under line; emit draft to parent
- Modify: `src/pages/PullDetailPage.tsx` — hold `PendingLineComment[]`; review bar to submit
- Test: `FileDiff.test.tsx` (create), `pulls.rs` unit tests for body serialization

**Interfaces:**
- `PendingLineComment { path: string; line: number; side: "RIGHT" | "LEFT"; body: string }`
- REST: `POST /repos/{o}/{r}/pulls/{n}/reviews` with `{ commit_id, event, body?, comments: [{ path, line, side, body }] }`
- Prefer single-shot submit (accumulate client-side, one API call) over multi-step PENDING review API

- [ ] **Step 1:** Failing test — DiffLineRow click calls `onStartComment({ line, side })`
- [ ] **Step 2:** Wire UI drafts + submit button “Submit review comments”
- [ ] **Step 3:** Extend Rust `CreateReviewBody` + command; register if new cmd
- [ ] **Step 4:** `pnpm test` relevant + `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- [ ] **Step 5:** Commit, push, PR (`close #492`), merge

---

### Task 2: #493 Approve / Request changes / Merge shortcuts

**Files:**
- Modify: `settingsStore.ts` — `ShortcutId`: `approvePull`, `requestChanges`, `mergePull` with keys `A`, `R`, `M`
- Modify: `PullDetailPage.tsx` or `PrFooterBar.tsx` — bind shortcuts; Merge opens confirm
- Test: `PrFooterBar.test.tsx` / `PullDetailPage.test.tsx`

- [ ] **Step 1:** Failing tests for keydown A/R/M calling handlers when not in input
- [ ] **Step 2:** Add ShortcutIds + wire `useSettingsShortcut`
- [ ] **Step 3:** Merge requires existing confirm dialog (add if missing)
- [ ] **Step 4:** Tests green → PR `close #493` → merge

---

### Task 3: #494 CI rerun failed jobs

**Files:**
- Modify: `rest.rs` — `rerun_workflow_failed_jobs(owner, repo, run_id)` → `POST .../actions/runs/{id}/rerun-failed-jobs`
- Create/Modify: `commands/ci.rs` — `cmd_rerun_workflow_failed_jobs`
- Modify: `lib.rs` register
- Modify: `WorkflowRunRow.tsx`, `CiStatusPage.tsx`; optionally ChecksTab if `run_id` available
- Test: REST/cmd unit or FE button test with mocked invoke

- [ ] **Step 1:** Failing test for button invoke
- [ ] **Step 2:** REST + cmd + UI
- [ ] **Step 3:** PR `close #494` → merge

---

### Task 4: #495 Sync mark-read to GitHub Notifications API

**Files:**
- Modify: `rest.rs` — `mark_notification_thread_read(thread_id)` → `PATCH /notifications/threads/{id}`
- Modify: `rest.rs` — optional `mark_all_notifications_read` → `PUT /notifications`
- Modify: `commands/inbox.rs` — after local SQLite update, call GitHub (best-effort or fail loudly per AC)
- Test: cmd test with mock / unit for REST path builder

**Acceptance choice:** On API failure, return error to UI (do not silently diverge). Local update may still apply if already done; document in PR.

- [ ] Implement + tests → PR `close #495` → merge

---

### Task 5: #496 PAT create one-click URL

**Files:**
- Modify: `PATTab.tsx` — replace span with button/link opening  
  `https://github.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github`  
  via `@tauri-apps/plugin-opener` / `openInBrowser`; GHES: `{host}/settings/tokens/new?...` when host set
- Modify: scopes error block — same link
- Test: `LoginPage.test.tsx` / PATTab test — click calls open

- [ ] Implement → PR `close #496` → merge

---

### Task 6: #502 Hide Projects / Discussions from nav & ⌘K

**Files:**
- Modify: `Sidebar.tsx` — remove Projects/Discussions if present (check current list)
- Modify: `CommandPalette.tsx` — remove `nav-discussions`, `nav-projects` from `NAV_COMMANDS`
- Keep routes for deep links
- Test: CommandPalette + Sidebar tests

- [ ] Implement → PR `close #502` → merge

---

### Task 7: #497 Cross-account Inbox without switching

**Files:**
- Extend inbox fetch or merge cached inbox per account into one list with `accountLogin` on items
- Modify: `InboxItem` type + `InboxItem.tsx` avatar/login badge
- Modify: `InboxPage.tsx` — toggle “All accounts” (default on when multi-account)
- Ensure actions use correct account token (may need `cmd_*` account_id param or switch active briefly — prefer pass `account_id` into cmds)
- Test: merge/filter unit tests

**MVP:** If multi-account cmd plumbing is large, show cross-account list read-only + “Switch & open” that activates account then navigates. Prefer full actions if existing attention summaries already have per-account data.

- [ ] Implement MVP → PR `close #497` → merge

---

### Task 8: #498 Open in editor path auto-resolve

**Files:**
- Modify: `settingsStore` — `repoRootDirs: string[]`
- Modify: Settings UI — add/remove root dirs
- Add: `src/lib/resolveRepoPath.ts` — match `owner/repo` under roots (dir name or `git remote` via new cmd)
- Modify: `cmd_open_pr_in_editor` callers to resolve path when map missing
- Optional Rust: `cmd_discover_repo_path(roots, full_name)`
- Test: resolve unit tests

- [ ] Implement → PR `close #498` → merge

---

### Task 9: #499 Hide Dependabot / bot PRs

**Files:**
- Modify: `lib/reviewQueue.ts` — `isBotLogin(login)` (`[bot]` suffix, `dependabot`, `renovate`, `github-actions`)
- Modify: `buildReviewQueue` + Inbox list filter with settings toggle `hideBotReviewRequests` (default true)
- Optionally plumb GraphQL author login into InboxItem (preferred)
- Test: `reviewQueue.test.ts`

- [ ] Implement → PR `close #499` → merge

---

### Task 10: #500 OS-aware Cmd/Ctrl labels

**Files:**
- Modify: `shortcutKeys.ts` — `modifierLabel()` / `displayShortcutKeys(raw)` using `navigator.platform` or userAgentData
- Modify: Settings Shortcuts list + ShortcutChips help to use display helper
- Keep matching Cmd/Ctrl interchangeable
- Test: display helper unit tests

- [ ] Implement → PR `close #500` → merge

---

### Task 11: #501 Expand G chords

**Files:**
- Modify: `settingsStore` — `goActivity: "G then A"`, `goCi: "G then C"`, `goReviewQueue: "G then R"`, `goBlockers: "G then B"`
- Modify: `GlobalShortcuts.tsx` — navigate to `/activity`, `/ci`, `/review-queue`, `/my-blockers`
- Test: GlobalShortcuts tests

- [ ] Implement → PR `close #501` → merge

---

### Task 12: #503 Linux packaging + docs

**Files:**
- Modify: `tauri.conf.json` — add `"appimage"` (and/or `"deb"`) to `bundle.targets`
- Modify: `README.md` — Linux install section + software rendering env vars from AGENTS.md
- Modify: `.github/workflows/ci.yml` or `release.yml` — optional Linux bundle job if secrets allow; otherwise document `pnpm tauri build` on Linux
- Test: config JSON valid; no need for full AppImage in CI if too heavy — at least `cargo check` on ubuntu already exists

- [ ] Implement → PR `close #503` → merge

---

### Task 13: #504 Watch org / starred bulk select

**Files:**
- Add REST: list user orgs, list org repos, list starred repos (octocrab/rest helpers)
- Add cmds: `cmd_list_watch_candidates` or separate cmds
- Modify: `WatchReposPrompt.tsx` + Settings Repositories — tabs Org / Starred / Search with multi-select Add
- Test: UI selection + invoke mocks

- [ ] Implement → PR `close #504` → merge

---

### Task 14: #505 Contributor DX

**Files:**
- Verify `package.json` `typecheck` already `tsc --noEmit` — keep/fix AGENTS.md if stale about tsgo
- Fix vitest teardown unhandled rejections (`AppShell` listen) — mock `listen` to return disposable; abort retries in tests
- README: Rust requirement → **1.85+** consistently; document Vite port **1430**
- Test: `pnpm test` exits 0; `pnpm typecheck` exits 0

- [ ] Implement → PR `close #505` → merge

---

### Task 15: Close #506

- [ ] Verify all children closed; comment on #506 and close with `gh issue close 506`

---

## Self-review

1. **Spec coverage:** #492–#505 each have a task; #506 closeout included. Exclusions listed in Global Constraints.
2. **Placeholders:** none intentional — each task names files and acceptance.
3. **Type consistency:** `PendingLineComment` and new `ShortcutId`s named once above.

**Test commands used throughout:**

```bash
pnpm test
pnpm exec tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml --lib
pnpm lint
```
