# UX Improvement Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close GitHub issues #277–#300 one at a time against `origin/main`, with a PR and merge after each issue.

**Architecture:** Work from `origin/main` (local `main` is stale). Many advertised shortcuts already fire through `useSettingsShortcut` + `ShortcutChips`. The remaining gap is chord sequences (`G then I`), chrome (status, badges, banners), and a few list/review/onboarding holes. Each issue is an independent branch `feat/<number>-<slug>` from the latest `origin/main` after the previous merge.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library, React Router 7, Tauri 2 `invoke` / `plugin-opener`.

**Execution rule (user):** After each issue: tests green → commit → push → `gh pr create` → `gh pr merge`. Then start the next issue. Do not bundle issues.

**Already present on `origin/main` (verify, then close with a locking test if coverage is missing):**

| Issue | Status on origin/main |
|---|---|
| #278 Inbox J/K Enter X | Implemented (`useListNavigation` + `markRead` / `markAllRead`). InboxPage tests cover J across sections. |
| #279 `?` overlay | Implemented (`ShortcutChips` help dialog). |
| #280 Cmd+T | Implemented (`useSettingsShortcut("workspaceSwitcher")`). Esc-from-detail is still missing. |
| #283 snooze H / Shift+H | Implemented. Pin is still hover-only. |
| #292 Cmd+F | Implemented on Pulls / Issues / Activity. Inbox list search is still missing. |

---

## File Structure

Shared (touched by several early issues):

- Modify: `src/lib/shortcutKeys.ts` — parse `G then I` into `{ chord, chordPrefix, key }` and match the second key.
- Modify: `src/lib/shortcutKeys.test.ts` — chord parse + match tests.
- Modify: `src/hooks/useSettingsShortcut.ts` — pending-prefix timer so chord shortcuts fire.
- Create: `src/components/layout/GlobalShortcuts.tsx` — goInbox / goPulls / goSettings / later Cmd+R / O.
- Modify: `src/components/layout/AppShell.tsx` — mount GlobalShortcuts; digest banner; offline retry; status strip.
- Modify: `src/stores/uiStore.ts` — digest banner flag, authExpired, list search, etc. only when that issue needs it.

Issue-specific files are listed under each task.

---

## Task 1: #277 Wire advertised chord shortcuts

**Files:**
- Modify: `src/lib/shortcutKeys.ts`
- Modify: `src/lib/shortcutKeys.test.ts`
- Modify: `src/hooks/useSettingsShortcut.ts`
- Create: `src/hooks/useSettingsShortcut.test.tsx`
- Create: `src/components/layout/GlobalShortcuts.tsx`
- Create: `src/components/layout/GlobalShortcuts.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Write failing chord tests**

Append to `src/lib/shortcutKeys.test.ts`:

```ts
it("parses G then I into a chord prefix and second key", () => {
  expect(parseShortcutKeys("G then I")).toEqual({
    key: "i",
    meta: false,
    shift: false,
    alt: false,
    chord: true,
    chordPrefix: "g",
    raw: "G then I",
  });
});

it("does not match a chord on a single keydown", () => {
  const event = new KeyboardEvent("keydown", { key: "i" });
  expect(eventMatchesShortcut(event, "G then I")).toBe(false);
});
```

Add `src/hooks/useSettingsShortcut.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsShortcut } from "./useSettingsShortcut";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../stores/settingsStore";

describe("useSettingsShortcut chords", () => {
  beforeEach(() => {
    useSettingsStore.setState({ shortcuts: DEFAULT_SHORTCUTS });
  });

  it("fires goInbox after G then I", () => {
    const handler = vi.fn();
    renderHook(() => useSettingsShortcut("goInbox", handler));
    fireEvent.keyDown(window, { key: "g" });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "i" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores the sequence inside an input", () => {
    const handler = vi.fn();
    renderHook(() => useSettingsShortcut("goInbox", handler));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "i" });
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/shortcutKeys.test.ts src/hooks/useSettingsShortcut.test.tsx`
Expected: FAIL — `chordPrefix` missing; goInbox never fires.

- [ ] **Step 3: Extend parseShortcutKeys**

In `parseShortcutKeys`, when `/\bthen\b/i` matches, split on `then` and return `{ chord: true, chordPrefix: firstKey, key: secondKey, ... }`. Keep `eventMatchesShortcut` returning false for chords (the hook owns the two-step match).

- [ ] **Step 4: Handle chords in useSettingsShortcut**

Keep a module-level or ref `pendingPrefix` + 800ms timeout. First keydown matching `chordPrefix` (no meta/alt) arms the chord. Second keydown matching `key` calls the handler. Ignore editable targets unless `allowInInputs`.

- [ ] **Step 5: Mount GlobalShortcuts in AppShell**

```tsx
export function GlobalShortcuts() {
  const navigate = useNavigate();
  useSettingsShortcut("goInbox", () => navigate("/inbox"));
  useSettingsShortcut("goPulls", () => navigate("/pulls"));
  useSettingsShortcut("goSettings", () => navigate("/settings"));
  return null;
}
```

Render next to `CommandPalette`. Do not steal Cmd+T / `?` / J/K — those already work.

- [ ] **Step 6: Tests pass, commit, PR, merge**

```bash
pnpm test src/lib/shortcutKeys.test.ts src/hooks/useSettingsShortcut.test.tsx src/components/layout/GlobalShortcuts.test.tsx src/components/layout/AppShell.test.tsx
git add src/lib/shortcutKeys.ts src/lib/shortcutKeys.test.ts src/hooks/useSettingsShortcut.ts src/hooks/useSettingsShortcut.test.tsx src/components/layout/GlobalShortcuts.tsx src/components/layout/GlobalShortcuts.test.tsx src/components/layout/AppShell.tsx
git commit -m "feat: wire G then I/P/S navigation shortcuts (#277)"
```

PR title: `feat: wire advertised G-then chords (#277)`  
Body: close #277

---

## Task 2: #278 Inbox J/K Enter X

**Files:**
- Modify: `src/pages/InboxPage.test.tsx` only if X/Enter coverage is missing.

origin/main already navigates with J/K, selects on Enter, dismisses with X. Add a test that X calls `cmd_dismiss_inbox_item` if not present, then close #278.

---

## Task 3: #279 Shortcut overlay

**Files:**
- Modify: `src/components/common/ShortcutChips.test.tsx` (create if missing)

`?` already toggles a dialog listing every settings shortcut. Add a test: press `?` → dialog "Shortcut help" → Esc closes. Close #279.

---

## Task 4: #280 Esc from detail + confirm Cmd+T

**Files:**
- Modify: `src/pages/PullDetailPage.tsx`
- Modify: `src/pages/IssueDetailPage.tsx`
- Create or modify their tests
- Cmd+T already works; do not rebind.

On detail routes, `useSettingsShortcut("closeDetail", () => navigate(-1))` unless a modal/palette is open. Esc on Inbox snooze picker stays local and wins (already preventDefault).

---

## Task 5: #281 Command palette actions

**Files:**
- Modify: `src/components/command/CommandPalette.tsx`
- Modify: `src/components/command/CommandPalette.test.tsx`

Add empty-query commands:

- Go to Digest → `/digest`
- Sync now → `invoke("cmd_sync_now")`
- Mark all as read → `invoke("cmd_mark_all_notifications_read")`
- Switch account → `openWorkspaceSwitcher()`

Keep existing nav commands.

---

## Task 6: #282 Inbox badge = actionable count

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Sidebar.test.tsx`
- Modify: `src/lib/badge.ts` usage

Inbox badge = current-account reviewRequests + ciFailures + mentions (from last inbox payload if stored) or `crossAccountTotal` when that is the intended cross-account view. Do not use `notifications.filter(unread).length` as the Inbox number. Dock badge may stay unread-notifications; document in the PR.

Need an inbox count in `dataStore` if not already: add `inboxCounts: { review, ci, mention }` updated by `useInboxQuery`.

---

## Task 7: #283 Pin on selected row + P key + Stale

**Files:**
- Modify: `src/components/inbox/InboxItem.tsx` — show Pin/Snooze when `selected`, not only `group-hover`
- Modify: `src/pages/InboxPage.tsx` — `useSettingsShortcut` or `P` → `handleTogglePin(active)`
- Modify: `src/components/inbox/InboxList.tsx` — pass `onTogglePin` / `onSnooze` into Stale section
- Tests in InboxItem.test.tsx / InboxPage.test.tsx / InboxList.test.tsx

Do not add a new ShortcutId unless Settings should show it; `P` can be a page-local key to avoid expanding the settings table this issue.

---

## Task 8: #284 Collapse Inbox preview when none selected

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/pages/InboxPage.test.tsx`

Unselected (and after Esc clears selection): grid is `1fr`. Selected: `1fr 1fr` and `InboxDetailPanel` mounts. Esc currently only closes snooze picker — also clear selection when picker is closed.

---

## Task 9: #285 Digest banner instead of navigate

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/stores/uiStore.ts` if a dismiss flag is needed

Replace `navigate("/digest")` with an Inbox-safe banner: "Digest is ready" + link to `/digest` + dismiss. Honor `digestAutoShowEnabled`. Startup path stays `/inbox` (or layout home).

---

## Task 10: #286 Inbox reason line

**Files:**
- Modify: `src/components/inbox/InboxItem.tsx`
- Modify: `src/components/inbox/InboxItem.test.tsx`

Map `kind`: `review_requested` → `Review requested`, `ci_failure` → `CI failing`, `mention` → `Mentioned`, stale ids → `Stale`. Put it in the existing meta row after repo/#.

---

## Task 11: #287 Review queue: X goes to next

**Files:**
- Modify: `src/pages/InboxPage.tsx` (already calls `focusAfterRemoval`)
- Modify: `src/pages/PullDetailPage.tsx` / `src/pages/ReviewQueuePage.tsx`

If opened from Inbox (search param `?from=inbox&id=`), X/done on the detail page should navigate to the next inbox item route. If already true on ReviewQueuePage, add the Inbox-origin query and a test; do not duplicate the queue page.

---

## Task 12: #288 Status strip + Cmd+R

**Files:**
- Create: `src/components/layout/SyncStatusBar.tsx`
- Create: `src/components/layout/SyncStatusBar.test.tsx`
- Modify: `src/stores/settingsStore.ts` — add ShortcutId `syncNow: { label: "Sync now", keys: "Cmd+R" }`
- Modify: `src/components/layout/GlobalShortcuts.tsx` — bind syncNow → `cmd_sync_now` + `markLastSynced`
- Modify: `src/pages/SettingsPage.tsx` — new id appears in Shortcuts tab automatically via Object.keys

Show `Last synced {formatRelativeTime(lastSyncedAt)}` and rate remaining from `cmd_get_sync_status` (already mocked in Settings tests).

---

## Task 13: #289 Offline banner retry

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/hooks/useOnlineStatus.ts` if a `retry()` exists; otherwise invoke `cmd_ping` + `cmd_sync_now`

Copy: `Offline · showing cache` + Retry button.

---

## Task 14: #290 Files changed next/prev file

**Files:**
- Modify: `src/pages/PullDetailPage.tsx` (Files tab)
- Modify: `src/components/pulls/FileTreePanel.tsx` if selection lives there
- Tests

`]` next file, `[` previous. Skip when target is editable or command palette open. Scroll the file header into view.

---

## Task 15: #291 Open in browser with O

**Files:**
- Modify: `src/components/layout/GlobalShortcuts.tsx` or page-level hooks
- Tests on PullDetailPage / IssueDetailPage / InboxPage

`O` opens `htmlUrl` via `@tauri-apps/plugin-opener` `openUrl`, fallback `window.open`. Ignore inputs. Do not collide with editor open.

---

## Task 16: #292 Cmd+F on Inbox

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/pages/InboxPage.test.tsx`

Reuse `useListSearch(accountId, "inbox")` + `matchesListSearch` on flattened items. Esc already closes search via `closeDetail` in that hook.

---

## Task 17: #293 compact density on lists

**Files:**
- Modify: `src/pages/PullsPage.tsx` — `estimateSize` from `density` (compact 40, comfortable 56)
- Modify: `src/pages/IssuesPage.tsx` similarly if virtualized
- Modify: `src/components/inbox/InboxItem.tsx` — use `padding-block: var(--row-pad-y)`
- Tests: changing density updates estimate or data-density attribute (already set by `useAppearanceEffect`)

---

## Task 18: #294 Pulls label filter

**Files:**
- Modify: `src/pages/PullsPage.tsx`
- Modify: `src/stores/dataStore.ts` if pulls lack labels — add `labels: string[]` to `PullSummary` if the API already sends them; otherwise parse from `raw` if present. If backend omits labels, add a frontend unique list from whatever field exists, or extend `cmd_list_pulls`. Prefer frontend unique labels from summaries first.

Replace `const availableLabels: string[] = []` with a `useMemo` over pulls.

---

## Task 19: #295 Save view inline input

**Files:**
- Modify: `src/pages/PullsPage.tsx`
- Modify: `src/pages/IssuesPage.tsx`
- Tests

Replace `window.prompt("View name")` with a small inline field in Toolbar: Enter saves, Esc cancels, empty string does not save.

---

## Task 20: #296 Grouped OS notifications + quiet hours

**Files:**
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/notifications.test.ts`
- Modify: `src/stores/settingsStore.ts` — `quietHours: { enabled, start, end }` (start/end `"22:00"` / `"08:00"`)
- Modify: `src/pages/SettingsPage.tsx` — Notifications tab
- Modify: `src/features/activity/useNotificationPolling.ts` dispatch site

Collapse same repo+kind within 60s into one notification body `CI failing ×3`. During quiet hours, skip OS notify (Inbox still updates).

---

## Task 21: #297 First-run watch repo picker

**Files:**
- Create: `src/components/onboarding/WatchReposPrompt.tsx`
- Create: `src/components/onboarding/WatchReposPrompt.test.tsx`
- Modify: `src/components/layout/AppShell.tsx` or Inbox empty state

If authenticated and `watchedRepositories.length === 0`, show a modal using existing `useRepoSearchQuery`. Require skip or ≥1 add. Persist skip in settingsStore `watchOnboardingDismissed`.

---

## Task 22: #298 Auth expired screen

**Files:**
- Modify: `src/stores/authStore.ts` — `status: "expired"`
- Modify: `src/App.tsx` / LoginPage
- Modify: query hooks that catch 401

On invoke 401 / "Bad credentials", set expired and render LoginPage with message `Token expired. Paste a new PAT.` Do not treat network errors as expired.

---

## Task 23: #299 Window title unread count

**Files:**
- Create: `src/hooks/useWindowTitle.ts`
- Create: `src/hooks/useWindowTitle.test.tsx`
- Modify: `src/App.tsx` or AppShell

`document.title = count > 0 ? `(${count}) my-github` : `my-github``. Count matches Inbox actionable badge from Task 6.

---

## Task 24: #300 List skeletons

**Files:**
- Create: `src/components/common/ListSkeleton.tsx`
- Modify: InboxPage, PullsPage, IssuesPage, ActivityPage — replace full-page Spinner when `loading && !data`

`role="status"` + `aria-busy`. Cached data still renders immediately (existing SWR behavior).

---

## Self-review

1. **Spec coverage:** #277–#300 each have a task. Done-on-main issues still get a verify/close step.
2. **Placeholders:** none — each remaining issue names files, tests, and the behavior to implement.
3. **Type consistency:** ShortcutId gains `syncNow` only in Task 12. Chord fields are `chordPrefix` + `key` on `ParsedShortcut`.

**Test commands used throughout:**

```bash
pnpm test
pnpm typecheck
```
