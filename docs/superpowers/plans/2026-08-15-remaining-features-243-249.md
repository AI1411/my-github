# Remaining Features (#243–#249) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MVP for open feature issues #243–#249, one issue per PR, merge to `main` before starting the next.

**Architecture:** Prefer thin command + lib helpers + Settings/Pull detail UI. Reuse existing `GithubClient`, `settingsStore`, and PR detail tabs. No new crates unless unavoidable.

**Tech Stack:** Tauri 2 / Rust commands, React 19 + Zustand, Vitest + `cargo test --lib`.

## Global Constraints

- Branch: `cursor/<descriptive-name>-732c`
- Close issue via PR body `close #N`
- Merge each PR before starting the next issue
- Keep MVPs scoped to acceptance criteria only

---

### Task 1: #243 CODEOWNERS / team review context

**Files:**
- Create: `src/lib/codeowners.ts`, `src/lib/codeowners.test.ts`
- Create: `src/components/pulls/ReviewContextPanel.tsx` (+ test)
- Modify: `src-tauri/src/github/types.rs` (`requested_teams`)
- Modify: `src-tauri/src/commands/pulls.rs` (`cmd_get_review_context`)
- Modify: `src-tauri/src/lib.rs`, `src/pages/PullDetailPage.tsx`

**Produces:** `cmd_get_review_context` → `{ requestedReviewers, requestedTeams, codeowners, submittedReviews }`

- [ ] Parse CODEOWNERS patterns + match changed files
- [ ] Fetch CODEOWNERS + PR teams + reviews in one command
- [ ] Panel next to conversation showing owners / unmet team requests
- [ ] Tests + PR + merge

### Task 2: #244 Full shortcut customization

**Files:** `src/stores/settingsStore.ts`, `src/pages/SettingsPage.tsx`, `src/hooks/useAppShortcuts.ts` (or existing), tests

- [ ] Expand `ShortcutId` to cover remaining app actions (review queue next, snooze, etc.)
- [ ] Capture keydown in Settings (record binding) + conflict warning
- [ ] Wire runtime handler to store values
- [ ] Tests + PR + merge

### Task 3: #245 Appearance

**Files:** `settingsStore`, `src/styles` / `AppShell`, Settings Appearance section

- [x] `theme: light | dark | system`, `layout: inbox-first | pulls-first` (Settings Appearance tab)
- [x] Apply CSS variables / `data-theme` on root (partial — density + theme toggles)
- [x] Density + layout toggle in Settings
- [ ] Tests + PR + merge

### Task 4: #246 Work-mode presets

**Files:** `src/lib/workModes.ts`, settingsStore, Sidebar / Settings

- [x] Work modes snapshot repos/rules/home route (Settings + ⌘T)
- [ ] Activate from Sidebar; CRUD in Settings
- [ ] Tests + PR + merge

### Task 5: #247 Local LLM PR summary

**Files:** `src/lib/localLlm.ts`, command or FE fetch to `http://127.0.0.1:11434`, PullDetail panel

- [ ] Settings: endpoint + model + enabled
- [ ] Summarize title+body+file list (no secret leak beyond local)
- [ ] Graceful offline / connection error UI
- [ ] Tests + PR + merge

### Task 6: #248 Open in editor (worktree / branch)

**Files:** `openInEditor.ts`, Settings, Rust `cmd_open_in_editor` if needed

- [ ] Local path map `owner/repo` → worktree root
- [ ] Open with `git checkout` / `git worktree` hint or shell open branch
- [ ] Button on PR detail uses mapped path + head ref
- [ ] Tests + PR + merge

### Task 7: #249 CI failure log excerpt

**Files:** `commands/pulls.rs` or `ci.rs`, ChecksTab

- [ ] For failed check runs, fetch annotations or log URL excerpt
- [ ] Show first ~40 lines / annotations in Checks tab expand
- [ ] Tests + PR + merge
