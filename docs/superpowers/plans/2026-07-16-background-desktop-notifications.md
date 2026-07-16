# Background Desktop Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver unread desktop notifications at the configured polling interval whenever the authenticated application is running, regardless of the active page or window focus.

**Architecture:** Add a focused React hook that owns immediate retrieval, recursive polling, per-account deduplication, shared data-store updates, and retry behavior. Mount that hook once in `AppShell`, expose its UI state and manual refresh through a small React context, and make Activity consume the application-level notification lifecycle instead of creating its own poller.

**Tech Stack:** React 19, TypeScript 5, Zustand, Tauri 2 IPC and notification plugin, Vitest, Testing Library

## Global Constraints

- Run monitoring only while the authenticated application process is running.
- Poll at the Settings value: 30 seconds, 60 seconds, or 5 minutes.
- Notify unread items found by the initial startup retrieval.
- Respect existing CI failure, review request, mention, and global notification toggles.
- Suppress duplicate notification IDs during one active-account session.
- Reset deduplication when the authenticated account changes.
- Stop timers and ignore stale results after logout or unmount.
- Keep failures non-fatal and retry on the next interval.
- Do not add system-tray, login-item, push-server, or post-exit behavior.

---

## File Structure

- Create `src/features/activity/useNotificationPolling.ts`: application-level retrieval, timer, deduplication, retry, and state.
- Create `src/features/activity/useNotificationPolling.test.ts`: fake-timer and account-lifecycle coverage.
- Create `src/features/activity/NotificationPollingContext.ts`: typed context used by AppShell and Activity.
- Modify `src/components/layout/AppShell.tsx`: mount one poller, register click navigation, and provide the context.
- Modify `src/components/layout/AppShell.test.tsx`: prove monitoring and click registration are application scoped.
- Modify `src/pages/ActivityPage.tsx`: consume shared polling state and the shared route helper.
- Modify `src/pages/ActivityPage.test.tsx`: provide context and preserve read/manual-refresh behavior.
- Delete `src/features/activity/useNotificationsQuery.ts`: replace the page-owned lifecycle.
- Delete `src/features/activity/useNotificationsQuery.test.ts`: coverage moves to the application poller tests.

### Task 1: Application-level polling hook

**Files:**
- Create: `src/features/activity/useNotificationPolling.ts`
- Create: `src/features/activity/useNotificationPolling.test.ts`
- Test: `src/lib/notifications.test.ts`

**Interfaces:**
- Consumes: `invoke<NotificationSummary[]>("cmd_get_notifications")`, `useAuthStore`, `useDataStore`, `useSettingsStore`, and `sendAppNotification`.
- Produces:

```ts
export interface NotificationPollingState {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNotificationPolling(): NotificationPollingState;
```

- [ ] **Step 1: Write failing tests for interval conversion and immediate retrieval**

Create tests that render the hook with an authenticated `octocat`, set `pollingInterval` to `30s`, and assert an immediate `cmd_get_notifications` call followed by another call after 30,000ms.

```ts
it("fetches immediately and again at the configured interval", async () => {
  vi.useFakeTimers();
  invokeMock.mockResolvedValue([]);

  renderHook(() => useNotificationPolling());
  await vi.waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith("cmd_get_notifications"),
  );

  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- src/features/activity/useNotificationPolling.test.ts
```

Expected: FAIL because `useNotificationPolling` does not exist.

- [ ] **Step 3: Implement the polling interval map and cancellable recursive timer**

Create the hook with exact interval values and schedule the next request after each request settles:

```ts
const POLLING_INTERVAL_MS: Record<PollingInterval, number> = {
  "30s": 30_000,
  "60s": 60_000,
  "5m": 300_000,
};

export function useNotificationPolling(): NotificationPollingState {
  const accountId = useAuthStore((state) => state.user?.login ?? null);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deliveredIds = useRef(new Set<string>());
  const deliveredAccount = useRef<string | null>(null);
  const generation = useRef(0);

  const fetchNotifications = useCallback(async () => {
    const currentGeneration = generation.current;
    setLoading(true);
    setError(null);
    try {
      const notifications = await invoke<NotificationSummary[]>(
        "cmd_get_notifications",
      );
      if (currentGeneration !== generation.current) return;
      useDataStore.getState().setNotifications(notifications);
      const settings = useSettingsStore.getState().notificationSettings;
      for (const notification of notifications) {
        if (!notification.unread || deliveredIds.current.has(notification.id)) {
          continue;
        }
        if (await sendAppNotification(notification, settings)) {
          deliveredIds.current.add(notification.id);
        }
      }
    } catch (cause) {
      if (currentGeneration === generation.current) setError(String(cause));
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    if (deliveredAccount.current !== accountId) {
      deliveredIds.current.clear();
      deliveredAccount.current = accountId;
    }
    if (!accountId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await fetchNotifications();
      if (!cancelled) {
        timer = setTimeout(poll, POLLING_INTERVAL_MS[pollingInterval]);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      generation.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [accountId, fetchNotifications, pollingInterval]);

  return { loading, error, refetch: () => void fetchNotifications() };
}
```

- [ ] **Step 4: Add failing tests for initial unread delivery and deduplication**

Return the same unread review request from two polls. Assert the first startup result is sent and the second result is suppressed.

```ts
expect(sendAppNotification).toHaveBeenCalledTimes(1);
expect(sendAppNotification).toHaveBeenCalledWith(
  unreadNotification,
  useSettingsStore.getState().notificationSettings,
);
```

- [ ] **Step 5: Run the focused test and verify RED for incomplete deduplication**

Run:

```bash
pnpm test -- src/features/activity/useNotificationPolling.test.ts
```

Expected: the new delivery or duplicate-suppression assertion fails before the full loop is implemented.

- [ ] **Step 6: Complete delivery, retry, and stale-result handling**

Ensure only successful sends enter `deliveredIds`, errors remain non-fatal, the recursive timer is scheduled from `finally`, and generation checks protect both store and state updates.

- [ ] **Step 7: Add and pass lifecycle tests**

Cover:

```ts
it("retries after a retrieval failure on the next interval", async () => {});
it("reschedules when pollingInterval changes", async () => {});
it("clears deduplication when the account changes", async () => {});
it("stops polling and ignores an in-flight result after unmount", async () => {});
```

For account switching, resolve the same notification ID for `octocat`, change `useAuthStore` to `hubot`, and expect a second desktop send.

- [ ] **Step 8: Run focused and notification tests**

Run:

```bash
pnpm test -- src/features/activity/useNotificationPolling.test.ts src/lib/notifications.test.ts
```

Expected: PASS with no failures.

- [ ] **Step 9: Commit the polling hook**

```bash
git add src/features/activity/useNotificationPolling.ts src/features/activity/useNotificationPolling.test.ts
git commit -m "feat: 通知をアプリ起動中に定期取得"
```

### Task 2: AppShell integration and Activity migration

**Files:**
- Create: `src/features/activity/NotificationPollingContext.ts`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`
- Modify: `src/pages/ActivityPage.tsx`
- Modify: `src/pages/ActivityPage.test.tsx`
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/notifications.test.ts`
- Delete: `src/features/activity/useNotificationsQuery.ts`
- Delete: `src/features/activity/useNotificationsQuery.test.ts`
- Test: `src/lib/notificationRoutes.test.ts`

**Interfaces:**
- Consumes: `useNotificationPolling()`, `registerAppNotificationClickHandler`, `notificationRoute`, `useDataStore`, and React Router `useNavigate`.
- Produces:

```ts
export const NotificationPollingContext =
  createContext<NotificationPollingState | null>(null);

export function useNotificationPollingContext(): NotificationPollingState;
```

- [ ] **Step 1: Write a failing AppShell integration test**

Mock the polling hook and click registration, render AppShell inside `MemoryRouter`, and assert both run without mounting Activity:

```ts
expect(useNotificationPolling).toHaveBeenCalledTimes(1);
expect(registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run AppShell test and verify RED**

Run:

```bash
pnpm test -- src/components/layout/AppShell.test.tsx
```

Expected: FAIL because AppShell does not mount the poller or click handler.

- [ ] **Step 3: Add the typed context**

```ts
const NotificationPollingContext =
  createContext<NotificationPollingState | null>(null);

export function useNotificationPollingContext() {
  const value = useContext(NotificationPollingContext);
  if (!value) {
    throw new Error(
      "useNotificationPollingContext must be used within AppShell",
    );
  }
  return value;
}
```

- [ ] **Step 4: Write a failing click-handler replacement test**

Call `registerAppNotificationClickHandler` twice with two callbacks, invoke the single registered native action listener, and assert only the latest callback receives the route:

```ts
await registerAppNotificationClickHandler(firstHandler);
await registerAppNotificationClickHandler(latestHandler);
registeredCallback({
  extra: { route: "/issues/octocat/hello/7" },
} as Options);

expect(firstHandler).not.toHaveBeenCalled();
expect(latestHandler).toHaveBeenCalledWith("/issues/octocat/hello/7");
expect(notificationPlugin.onAction).toHaveBeenCalledTimes(1);
```

- [ ] **Step 5: Run the notification test and verify RED**

Run:

```bash
pnpm test -- src/lib/notifications.test.ts
```

Expected: FAIL because the current early return keeps the first callback.

- [ ] **Step 6: Keep one native listener while replacing its active callback**

Add a module-level callback reference and update it before the registration guard:

```ts
let activeClickHandler: ((route: string) => void) | null = null;

export async function registerAppNotificationClickHandler(
  onOpenRoute: (route: string) => void,
): Promise<void> {
  activeClickHandler = onOpenRoute;
  if (clickHandlerRegistered) return;
  // register native action type and listener once
  await onAction((notification) => {
    const route = notification.extra?.route;
    if (typeof route === "string") activeClickHandler?.(route);
  });
  clickHandlerRegistered = true;
}
```

- [ ] **Step 7: Mount polling and click navigation in AppShell**

In AppShell, call `useNotificationPolling()`, call `useNavigate()`, and register the click handler in an effect:

```tsx
const polling = useNotificationPolling();
const navigate = useNavigate();

useEffect(() => {
  void registerAppNotificationClickHandler((route) => navigate(route));
}, [navigate]);

return (
  <NotificationPollingContext.Provider value={polling}>
    {/* existing shell */}
  </NotificationPollingContext.Provider>
);
```

- [ ] **Step 8: Run AppShell and notification tests and verify GREEN**

Run:

```bash
pnpm test -- src/components/layout/AppShell.test.tsx src/lib/notifications.test.ts
```

Expected: PASS.

- [ ] **Step 9: Write failing Activity tests against shared state**

Wrap Activity in `NotificationPollingContext.Provider`, seed `useDataStore.notifications`, and assert:

- Activity renders the seeded notification without issuing an automatic fetch.
- Mark all read calls `cmd_mark_all_notifications_read` and then `refetch`.
- Selecting an unread item calls `cmd_mark_notification_read`, then `refetch`, then navigates using `notificationRoute`.

- [ ] **Step 10: Run Activity test and verify RED**

Run:

```bash
pnpm test -- src/pages/ActivityPage.test.tsx
```

Expected: FAIL because Activity still owns `useNotificationsQuery` and click registration.

- [ ] **Step 11: Migrate Activity to context and shared store**

Replace the page hook and local route implementation:

```ts
const notifications = useDataStore((state) => state.notifications);
const { loading, error, refetch } = useNotificationPollingContext();
```

Import `notificationRoute` from `src/lib/notificationRoutes.ts`. Remove the Activity-level click-handler effect and local `notificationRoute` function.

- [ ] **Step 12: Delete the obsolete page-owned hook and tests**

Delete:

```text
src/features/activity/useNotificationsQuery.ts
src/features/activity/useNotificationsQuery.test.ts
```

Confirm there are no remaining imports:

```bash
rg -n "useNotificationsQuery|registerAppNotificationClickHandler" src
```

Expected: `useNotificationsQuery` has no matches; click registration appears only in AppShell and notification module/tests.

- [ ] **Step 13: Run integration tests**

Run:

```bash
pnpm test -- src/components/layout/AppShell.test.tsx src/pages/ActivityPage.test.tsx src/lib/notifications.test.ts src/lib/notificationRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 14: Commit the application lifecycle migration**

```bash
git add src/components/layout/AppShell.tsx src/components/layout/AppShell.test.tsx src/features/activity/NotificationPollingContext.ts src/lib/notifications.ts src/lib/notifications.test.ts src/pages/ActivityPage.tsx src/pages/ActivityPage.test.tsx src/features/activity/useNotificationsQuery.ts src/features/activity/useNotificationsQuery.test.ts
git commit -m "refactor: 通知監視をAppShellへ移動"
```

### Task 3: Full verification and documentation alignment

**Files:**
- Modify only if verification exposes a defect in files changed by Tasks 1-2.

**Interfaces:**
- Consumes: completed application-level notification polling.
- Produces: a verified branch with no known feature regressions.

- [ ] **Step 1: Run formatting on changed frontend files**

```bash
pnpm exec oxfmt --write \
  src/features/activity/useNotificationPolling.ts \
  src/features/activity/useNotificationPolling.test.ts \
  src/features/activity/NotificationPollingContext.ts \
  src/components/layout/AppShell.tsx \
  src/components/layout/AppShell.test.tsx \
  src/pages/ActivityPage.tsx \
  src/pages/ActivityPage.test.tsx
```

- [ ] **Step 2: Run the complete frontend gate**

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all tests pass, lint reports zero errors, type checking succeeds, and the frontend build exits 0. Existing React `act(...)` and bundle-size warnings must be reported separately if still present.

- [ ] **Step 3: Run Rust regression tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: 192 tests pass and the three OS-keychain tests remain ignored, unless the repository test count legitimately changes.

- [ ] **Step 4: Review the final diff and compatibility constraints**

```bash
git diff --check
git status --short
rg -n "useNotificationsQuery" src
```

Expected: no whitespace errors, only intended files remain modified, and the obsolete hook has no references.

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification required code changes, stage only those files and commit:

```bash
git commit -m "fix: バックグラウンド通知の検証不備を修正"
```

If no files changed, do not create an empty commit.
