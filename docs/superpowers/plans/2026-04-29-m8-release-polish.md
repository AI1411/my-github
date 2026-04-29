# M8 Release Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every M8 setting, notification, resilience, and release-readiness item from GitHub issues #141-#156.

**Architecture:** Keep user preferences in a focused frontend Zustand settings store persisted to `localStorage`, and keep the backend authoritative for Tauri-only commands such as ping and frontend error logging. Settings UI remains view-first and dense, while OS integration is isolated in small adapter modules so tests can run in jsdom without Tauri. Release packaging work stays in config, docs, and GitHub Actions.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Tauri 2, Rust, SQLite, GitHub Actions.

---

## File Structure

- Create `src/stores/settingsStore.ts`: local persisted settings for watched repositories, notification toggles, polling interval, dock badge, appearance density, and shortcut customizations.
- Create `src/stores/settingsStore.test.ts`: store persistence and reducer-style behavior tests.
- Modify `src/pages/SettingsPage.tsx`: replace placeholder with Accounts / Repositories / Notifications / Appearance / Shortcuts / About tabs.
- Create `src/pages/SettingsPage.test.tsx`: rendering and interaction tests for M8 tabs.
- Create `src/lib/notificationRoutes.ts`: convert GitHub URLs to app routes and classify notification kinds.
- Create `src/lib/notificationRoutes.test.ts`: route/classification tests.
- Create `src/lib/notifications.ts`: Tauri notification permission/send adapter plus browser fallback click navigation.
- Create `src/lib/notifications.test.ts`: permission and dispatch tests with mocked adapter.
- Create `src/lib/badge.ts`: app-wide Dock/taskbar badge adapter using Tauri window APIs.
- Create `src/lib/badge.test.ts`: badge count/no-op behavior tests.
- Modify `src/features/activity/useNotificationsQuery.ts`: write loaded notifications into `dataStore` and emit eligible desktop notifications once per thread.
- Modify `src/components/layout/Sidebar.tsx`: update badge count from unread notifications and setting toggle.
- Modify `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, and `src-tauri/capabilities/default.json`: enable Tauri notification plugin.
- Create `src/components/common/ErrorBoundary.tsx`: page-level error boundary that logs frontend errors to Rust.
- Create `src/components/common/ErrorBoundary.test.tsx`: fallback rendering and log command tests.
- Modify `src/lib/router.tsx`: wrap shell/page content with `ErrorBoundary`.
- Create `src/hooks/useOnlineStatus.ts`: combine `navigator.onLine` and `cmd_ping`.
- Create `src/hooks/useOnlineStatus.test.tsx`: online/offline event tests.
- Modify `src/stores/uiStore.ts` and `src/stores/uiStore.test.ts`: add `offline` state and setter.
- Modify `src/components/layout/AppShell.tsx`: render an offline banner.
- Create `src-tauri/src/commands/system.rs`: `cmd_ping` and `cmd_log_frontend_error`.
- Create `src-tauri/src/db/sql/v3_error_logs.sql`: `error_logs` table.
- Modify `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/mod.rs`, and `src-tauri/src/commands/mod.rs`: register migration and commands.
- Add `src-tauri/icons/icon-1024.png`: 1024x1024 source icon for release icon generation.
- Modify `src-tauri/tauri.conf.json`: production bundle metadata and release bundle settings.
- Create `docs/release/signing-and-notarization.md`: macOS signing secret contract and local verification commands.
- Create `.github/workflows/release.yml`: tag-driven macOS/Windows release build and artifact upload.
- Create `CHANGELOG.md`: v0.1.0 release notes.
- Modify `docs/tasks.md`: mark M8 items complete only after verification passes.

## Task 1: Settings Store and Settings Page

**Files:**
- Create: `src/stores/settingsStore.ts`
- Create: `src/stores/settingsStore.test.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Create: `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write failing store tests**

Add tests covering default polling interval, notification toggle, watched repository add/remove, and shortcut override:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  useSettingsStore,
} from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      watchedRepositories: [],
      notificationSettings: {
        enabled: true,
        ciFailures: true,
        reviewRequests: true,
        mentions: true,
      },
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("defaults to 60 second polling and enabled notifications", () => {
    const state = useSettingsStore.getState();
    expect(state.pollingInterval).toBe("60s");
    expect(state.notificationSettings.enabled).toBe(true);
  });

  it("adds and removes watched repositories", () => {
    useSettingsStore.getState().addWatchedRepository("AI1411/my-github");
    useSettingsStore.getState().addWatchedRepository("AI1411/my-github");
    expect(useSettingsStore.getState().watchedRepositories).toEqual([
      "AI1411/my-github",
    ]);
    useSettingsStore.getState().removeWatchedRepository("AI1411/my-github");
    expect(useSettingsStore.getState().watchedRepositories).toEqual([]);
  });

  it("updates notification settings and polling interval", () => {
    useSettingsStore.getState().setPollingInterval("5m");
    useSettingsStore.getState().setNotificationSetting("ciFailures", false);
    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
    expect(useSettingsStore.getState().notificationSettings.ciFailures).toBe(false);
  });

  it("customizes and resets shortcuts", () => {
    useSettingsStore.getState().setShortcut("commandPalette", "Ctrl+K");
    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe("Ctrl+K");
    useSettingsStore.getState().resetShortcuts();
    expect(useSettingsStore.getState().shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });
});
```

- [ ] **Step 2: Run failing store test**

Run:

```bash
pnpm test src/stores/settingsStore.test.ts
```

Expected: FAIL because `settingsStore.ts` does not exist.

- [ ] **Step 3: Implement the settings store**

Implement typed defaults and actions:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PollingInterval = "30s" | "60s" | "5m" | "off";
export type AppearanceDensity = "compact" | "comfortable";
export type ShortcutId =
  | "commandPalette"
  | "workspaceSwitcher"
  | "listUp"
  | "listDown"
  | "openDetail"
  | "closeDetail"
  | "markRead"
  | "markAllRead"
  | "goInbox"
  | "goPulls"
  | "goSettings"
  | "shortcutHelp";

export interface ShortcutSetting {
  label: string;
  keys: string;
}

export const DEFAULT_SHORTCUTS: Record<ShortcutId, ShortcutSetting> = {
  commandPalette: { label: "Command palette", keys: "Cmd+K" },
  workspaceSwitcher: { label: "Workspace switcher", keys: "Cmd+T" },
  listUp: { label: "Move up", keys: "K" },
  listDown: { label: "Move down", keys: "J" },
  openDetail: { label: "Open detail", keys: "Enter" },
  closeDetail: { label: "Close detail", keys: "Esc" },
  markRead: { label: "Mark read", keys: "X" },
  markAllRead: { label: "Mark all read", keys: "Shift+X" },
  goInbox: { label: "Go to Inbox", keys: "G then I" },
  goPulls: { label: "Go to Pulls", keys: "G then P" },
  goSettings: { label: "Go to Settings", keys: "G then S" },
  shortcutHelp: { label: "Shortcut help", keys: "?" },
};
```

Store actions:

```ts
export interface SettingsState {
  watchedRepositories: string[];
  notificationSettings: {
    enabled: boolean;
    ciFailures: boolean;
    reviewRequests: boolean;
    mentions: boolean;
  };
  pollingInterval: PollingInterval;
  dockBadgeEnabled: boolean;
  density: AppearanceDensity;
  shortcuts: Record<ShortcutId, ShortcutSetting>;
  addWatchedRepository: (repo: string) => void;
  removeWatchedRepository: (repo: string) => void;
  setNotificationSetting: (
    key: keyof SettingsState["notificationSettings"],
    enabled: boolean,
  ) => void;
  setPollingInterval: (interval: PollingInterval) => void;
  setDockBadgeEnabled: (enabled: boolean) => void;
  setDensity: (density: AppearanceDensity) => void;
  setShortcut: (id: ShortcutId, keys: string) => void;
  resetShortcuts: () => void;
}
```

- [ ] **Step 4: Verify store tests pass**

Run:

```bash
pnpm test src/stores/settingsStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing Settings page tests**

Test that all tabs render, repositories can be added/removed, polling can switch to 5m, shortcuts can be customized, and About loads rate limit from `cmd_sync_now`.

- [ ] **Step 6: Run failing page test**

Run:

```bash
pnpm test src/pages/SettingsPage.test.tsx
```

Expected: FAIL because `SettingsPage` still renders a placeholder.

- [ ] **Step 7: Implement Settings page**

Render `Tabs` with six IDs: `accounts`, `repositories`, `notifications`, `appearance`, `shortcuts`, `about`. Use dense full-width sections with existing design tokens, not marketing cards. The Accounts tab shows the active user from `authStore`, an `Add account` button, a `Reauth` button, and a `Remove` button that calls the existing sign-out path only for the current account UI. The Repositories tab derives repo suggestions from `dataStore` and persists watched repos in `settingsStore`. The Notifications tab uses segmented controls for `30s`, `60s`, `5m`, `off`, and toggles OS notifications, CI failures, review requests, mentions, and Dock badge. The Appearance tab exposes dark theme fixed plus density toggle. The Shortcuts tab renders every `DEFAULT_SHORTCUTS` entry with editable text inputs. The About tab imports `package.json` version and invokes `cmd_sync_now` to show rate-limit `remaining` and `reset`.

- [ ] **Step 8: Verify page tests pass**

Run:

```bash
pnpm test src/pages/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/stores/settingsStore.ts src/stores/settingsStore.test.ts src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat: M8 settings画面を実装"
```

## Task 2: OS Notifications and Dock/Taskbar Badge

**Files:**
- Create: `src/lib/notificationRoutes.ts`
- Create: `src/lib/notificationRoutes.test.ts`
- Create: `src/lib/notifications.ts`
- Create: `src/lib/notifications.test.ts`
- Create: `src/lib/badge.ts`
- Create: `src/lib/badge.test.ts`
- Modify: `src/features/activity/useNotificationsQuery.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Write failing route tests**

Add tests:

```ts
expect(notificationRoute("https://github.com/AI1411/my-github/pull/189")).toBe(
  "/pulls/AI1411/my-github/189",
);
expect(notificationRoute("https://github.com/AI1411/my-github/issues/118")).toBe(
  "/issues/AI1411/my-github/118",
);
expect(notificationKind({ reason: "review_requested", subjectType: "PullRequest" })).toBe(
  "reviewRequest",
);
expect(notificationKind({ reason: "ci_failure", subjectType: "CheckSuite" })).toBe(
  "ciFailure",
);
```

- [ ] **Step 2: Run failing route tests**

Run:

```bash
pnpm test src/lib/notificationRoutes.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement route helpers**

Implement:

```ts
export type DesktopNotificationKind = "ciFailure" | "reviewRequest" | "mention" | null;

export function notificationRoute(htmlUrl: string | null): string | null {
  if (!htmlUrl) return null;
  const match = htmlUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, type, number] = match;
  return type === "pull"
    ? `/pulls/${owner}/${repo}/${number}`
    : `/issues/${owner}/${repo}/${number}`;
}
```

Classify `review_requested`, `mention`, `ci_failure`, and `CheckSuite` failures.

- [ ] **Step 4: Add notification plugin dependencies**

Run:

```bash
pnpm add @tauri-apps/plugin-notification
cargo add tauri-plugin-notification --manifest-path src-tauri/Cargo.toml
```

Then initialize the plugin in `src-tauri/src/lib.rs` with `.plugin(tauri_plugin_notification::init())` and add `"notification:default"` to `src-tauri/capabilities/default.json`.

- [ ] **Step 5: Write failing notification adapter tests**

Mock Tauri notification methods and assert permission request is called when enabled and permission is missing. Assert disabled settings skip sends.

- [ ] **Step 6: Implement notification adapter**

Use the Tauri plugin API:

```ts
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}
```

`sendPulseNotification` builds titles for CI failures, review requests, and mentions, calls `ensureNotificationPermission`, then uses `sendNotification({ title, body })`. A browser `Notification` fallback attaches an `onclick` handler for route navigation in dev/test.

- [ ] **Step 7: Write failing badge tests**

Mock `getCurrentWindow().setBadgeCount` and assert unread count is passed when enabled and `undefined` clears when disabled or zero.

- [ ] **Step 8: Implement badge adapter**

Use Tauri window API:

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function updateUnreadBadge(count: number, enabled: boolean): Promise<void> {
  const badge = enabled && count > 0 ? count : undefined;
  await getCurrentWindow().setBadgeCount(badge);
}
```

Catch and ignore unsupported platform errors so Windows dev/test does not break.

- [ ] **Step 9: Wire notifications and badge**

In `useNotificationsQuery`, call `useDataStore.getState().setNotifications(ns)` after successful load and send each unread eligible desktop notification once per thread ID. In `Sidebar`, compute unread count and call `updateUnreadBadge(unreadCount, dockBadgeEnabled)` in an effect.

- [ ] **Step 10: Verify notification tests pass**

Run:

```bash
pnpm test src/lib/notificationRoutes.test.ts src/lib/notifications.test.ts src/lib/badge.test.ts src/features/activity/useNotificationsQuery.test.ts src/components/layout/Sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json src/lib/notificationRoutes.ts src/lib/notificationRoutes.test.ts src/lib/notifications.ts src/lib/notifications.test.ts src/lib/badge.ts src/lib/badge.test.ts src/features/activity/useNotificationsQuery.ts src/features/activity/useNotificationsQuery.test.ts src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: M8 OS通知と未読バッジを追加"
```

## Task 3: Error Boundary and Offline Detection

**Files:**
- Create: `src/components/common/ErrorBoundary.tsx`
- Create: `src/components/common/ErrorBoundary.test.tsx`
- Modify: `src/lib/router.tsx`
- Create: `src/hooks/useOnlineStatus.ts`
- Create: `src/hooks/useOnlineStatus.test.tsx`
- Modify: `src/stores/uiStore.ts`
- Modify: `src/stores/uiStore.test.ts`
- Modify: `src/components/layout/AppShell.tsx`
- Create: `src-tauri/src/commands/system.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/db/sql/v3_error_logs.sql`
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: Write failing uiStore offline tests**

Add:

```ts
it("defaults offline to false", () => {
  expect(useUiStore.getState().offline).toBe(false);
});

it("setOffline updates offline state", () => {
  useUiStore.getState().setOffline(true);
  expect(useUiStore.getState().offline).toBe(true);
});
```

- [ ] **Step 2: Implement uiStore offline state**

Add `offline: boolean` and `setOffline(offline: boolean)` to `UiState`.

- [ ] **Step 3: Write failing backend migration tests**

Add tests asserting migrations include v3 and `error_logs` exists after `run_migrations`.

- [ ] **Step 4: Implement error log migration and system command**

`v3_error_logs.sql`:

```sql
CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
```

`cmd_log_frontend_error` inserts into `error_logs`; `cmd_ping` performs `GET https://api.github.com/rate_limit` with a short timeout and returns `true` on success, `false` on request failure.

- [ ] **Step 5: Write failing ErrorBoundary tests**

Render a component that throws, assert fallback text appears, and assert `invoke("cmd_log_frontend_error", ...)` is called with message and component stack.

- [ ] **Step 6: Implement ErrorBoundary and route wrapping**

`ErrorBoundary` uses `componentDidCatch`, logs through Tauri `invoke`, and renders a compact fallback with retry button. Wrap `main={<ErrorBoundary><Outlet /></ErrorBoundary>}` in `ShellLayout`.

- [ ] **Step 7: Write failing offline hook tests**

Mock `navigator.onLine` and `invoke("cmd_ping")`, dispatch `offline` / `online`, and assert `uiStore.offline` updates.

- [ ] **Step 8: Implement offline hook and banner**

`useOnlineStatus` sets offline immediately from `navigator.onLine`, then confirms online state with `cmd_ping`. `AppShell` calls the hook and renders a small top banner when `offline` is true.

- [ ] **Step 9: Verify all resilience tests pass**

Run:

```bash
pnpm test src/stores/uiStore.test.ts src/components/common/ErrorBoundary.test.tsx src/hooks/useOnlineStatus.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml db:: system --quiet
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/stores/uiStore.ts src/stores/uiStore.test.ts src/components/common/ErrorBoundary.tsx src/components/common/ErrorBoundary.test.tsx src/lib/router.tsx src/hooks/useOnlineStatus.ts src/hooks/useOnlineStatus.test.tsx src/components/layout/AppShell.tsx src-tauri/src/commands/system.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/db/sql/v3_error_logs.sql src-tauri/src/db/migrations.rs src-tauri/src/db/mod.rs
git commit -m "feat: M8 エラー境界とオフライン検知を追加"
```

## Task 4: Release Assets, Bundle Config, Actions, and Changelog

**Files:**
- Add: `src-tauri/icons/icon-1024.png`
- Modify: `src-tauri/tauri.conf.json`
- Create: `docs/release/signing-and-notarization.md`
- Create: `.github/workflows/release.yml`
- Create: `CHANGELOG.md`
- Modify: `docs/tasks.md`

- [ ] **Step 1: Create or verify 1024 icon source**

Generate `src-tauri/icons/icon-1024.png` at 1024x1024, then keep the existing generated Tauri icon set listed in `tauri.conf.json`. Verify:

```bash
file src-tauri/icons/icon-1024.png
```

Expected: `PNG image data, 1024 x 1024`.

- [ ] **Step 2: Update bundle metadata**

Set production metadata in `src-tauri/tauri.conf.json`:

```json
"identifier": "dev.ai1411.pulse",
"bundle": {
  "active": true,
  "targets": ["dmg", "msi", "nsis"],
  "publisher": "AI1411",
  "copyright": "Copyright © 2026 AI1411",
  "shortDescription": "GitHub cross-repository dashboard",
  "longDescription": "Pulse is a keyboard-driven GitHub dashboard for reviewing pull requests, issues, CI, and notifications across repositories.",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

- [ ] **Step 3: Add signing and notarization docs**

Document these required repository secrets exactly: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

- [ ] **Step 4: Add release workflow**

Create `.github/workflows/release.yml` triggered by `push.tags: ["v*"]`. Matrix build `macos-latest` and `windows-latest`, run `pnpm install --frozen-lockfile`, install Rust stable, run `pnpm build`, run `pnpm tauri build`, then upload `src-tauri/target/release/bundle/**/*` to a GitHub release.

- [ ] **Step 5: Add changelog**

Create `CHANGELOG.md` with `## [0.1.0] - 2026-04-29` and sections for Inbox, PRs, Issues, Activity, Settings, Notifications, Resilience, and Release.

- [ ] **Step 6: Mark M8 tasks complete**

Change only M8-001 through M8-016 in `docs/tasks.md` from `[ ]` to `[x]`.

- [ ] **Step 7: Verify release files**

Run:

```bash
pnpm exec prettier --check .github/workflows/release.yml
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --quiet
```

Expected: PASS. If Prettier is unavailable, validate YAML with `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release.yml')"`.

- [ ] **Step 8: Commit**

Run:

```bash
git add src-tauri/icons/icon-1024.png src-tauri/tauri.conf.json docs/release/signing-and-notarization.md .github/workflows/release.yml CHANGELOG.md docs/tasks.md
git commit -m "chore: M8 リリース設定を追加"
```

## Task 5: Final Verification

**Files:**
- Modify: no production files unless verification exposes defects.

- [ ] **Step 1: Run full frontend verification**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 2: Run React Doctor**

Run:

```bash
npx -y react-doctor@latest . --verbose --diff
```

Expected: no correctness/security blockers. Fix actionable errors and rerun.

- [ ] **Step 3: Run Rust verification**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --quiet
```

Expected: all commands PASS.

- [ ] **Step 4: Commit verification fixes if any**

If formatting/lint fixes were needed:

```bash
git add <changed-files>
git commit -m "fix: M8 検証で見つかった指摘を修正"
```

## Self-Review

- Spec coverage: M8-001 through M8-006 are covered by Task 1. M8-007 through M8-009 are covered by Task 2. M8-010 and M8-011 are covered by Task 3. M8-012 through M8-016 are covered by Task 4.
- Placeholder scan: No TBD/TODO/later placeholders remain. The release secret names are explicit, and commands include expected outcomes.
- Type consistency: `PollingInterval`, `ShortcutId`, `notificationRoute`, `notificationKind`, `updateUnreadBadge`, `cmd_ping`, and `cmd_log_frontend_error` are used consistently across their planned tests and implementations.

