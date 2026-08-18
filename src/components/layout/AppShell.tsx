import { useEffect, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Link, useNavigate } from "react-router-dom";
import { NotificationPollingContext } from "../../features/activity/NotificationPollingContext";
import { useNotificationPolling } from "../../features/activity/useNotificationPolling";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useFocusResumeRevalidate } from "../../hooks/useFocusResumeRevalidate";
import { useWriteQueue } from "../../hooks/useWriteQueue";
import { loadDigestLastSeen, shouldShowDigest } from "../../lib/digest";
import { registerAppNotificationClickHandler } from "../../lib/notifications";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { useUiStore } from "../../stores/uiStore";
import { CommandPalette } from "../command/CommandPalette";
import { ShortcutChips } from "../common/ShortcutChips";
import { WatchReposPrompt } from "../onboarding/WatchReposPrompt";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { SyncStatusBar } from "./SyncStatusBar";

export interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  secondary?: ReactNode;
}

const CLICK_HANDLER_RETRY_BASE_MS = 250;
const CLICK_HANDLER_MAX_ATTEMPTS = 5;

export function AppShell({ sidebar, main, secondary }: AppShellProps) {
  useOnlineStatus();
  const polling = useNotificationPolling();
  useFocusResumeRevalidate(polling.refetch);
  const { pendingCount, flushing, retry, discardAll } = useWriteQueue();
  const navigate = useNavigate();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const offline = useUiStore((s) => s.offline);
  const rateLimitHit = useUiStore((s) => s.rateLimitHit);
  const setRateLimitHit = useUiStore((s) => s.setRateLimitHit);
  const pushSyncEnabled = useSettingsStore((s) => s.pushSyncEnabled);
  const [digestBanner, setDigestBanner] = useState(false);
  const setOffline = useUiStore((s) => s.setOffline);
  const markLastSynced = useDataStore((s) => s.markLastSynced);

  async function retryConnection() {
    if (!window.navigator.onLine) {
      setOffline(true);
      return;
    }
    try {
      const reachable = await invoke<boolean>("cmd_ping");
      setOffline(!reachable);
      if (reachable) {
        await invoke("cmd_sync_now");
        markLastSynced();
      }
    } catch {
      setOffline(true);
    }
  }

  // トレイメニューの "Open Inbox" でInboxへ遷移する
  useEffect(() => {
    const unlisten = listen("tray-open-inbox", () => navigate("/inbox"));
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [navigate]);

  // Sync 401 / expired PAT → auth expired screen
  useEffect(() => {
    const unlisten = listen("auth-expired", () => {
      useAuthStore.getState().setExpired();
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  // レート制限ヒットをバナー表示し、reset 時刻後に消す
  useEffect(() => {
    const unlisten = listen<{ remaining: number; reset: number }>("rate-limit-hit", (event) => {
      setRateLimitHit({
        remaining: event.payload.remaining,
        reset: event.payload.reset,
      });
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [setRateLimitHit]);

  useEffect(() => {
    if (!rateLimitHit) return;
    const ms = rateLimitHit.reset * 1000 - Date.now();
    if (ms <= 0) {
      setRateLimitHit(null);
      return;
    }
    const timer = setTimeout(() => setRateLimitHit(null), ms);
    return () => clearTimeout(timer);
  }, [rateLimitHit, setRateLimitHit]);

  // 起動時、前回のダイジェスト表示から間が空いていればバナーを出す（Inbox からは離れない）
  useEffect(() => {
    const { digestAutoShowEnabled } = useSettingsStore.getState();
    if (!digestAutoShowEnabled) return;
    if (shouldShowDigest(loadDigestLastSeen(), new Date())) {
      setDigestBanner(true);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let disposeClickHandler: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const register = (attempt: number) => {
      void registerAppNotificationClickHandler((route) => navigate(route))
        .then((dispose) => {
          if (disposed) {
            dispose();
          } else {
            disposeClickHandler = dispose;
          }
        })
        .catch(() => {
          if (disposed || attempt >= CLICK_HANDLER_MAX_ATTEMPTS) return;
          retryTimer = setTimeout(
            () => register(attempt + 1),
            CLICK_HANDLER_RETRY_BASE_MS * 2 ** (attempt - 1),
          );
        });
    };

    register(1);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      disposeClickHandler?.();
    };
  }, [navigate]);

  const gridCols = sidebarCollapsed
    ? secondary
      ? "0px 1fr 1fr"
      : "0px 1fr"
    : secondary
      ? "220px 1fr 1fr"
      : "220px 1fr";

  return (
    <NotificationPollingContext.Provider value={polling}>
      <div
        className="min-h-screen h-screen w-screen grid overflow-hidden"
        style={{
          gridTemplateColumns: gridCols,
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
        }}
      >
        <aside
          className="h-full overflow-y-auto border-r"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary)",
            visibility: sidebarCollapsed ? "hidden" : "visible",
          }}
        >
          {sidebar}
        </aside>
        <main className="h-full overflow-hidden flex flex-col">
          {digestBanner && (
            <div
              role="status"
              data-testid="digest-ready-banner"
              className="border-b px-4 py-2 text-xs font-semibold flex items-center gap-3"
              style={{
                backgroundColor: "rgba(56, 139, 253, 0.12)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              <span>Digest is ready</span>
              <Link
                to="/digest"
                className="underline"
                style={{ color: "var(--accent-blue, #58a6ff)" }}
                onClick={() => setDigestBanner(false)}
              >
                Open Digest
              </Link>
              <button
                type="button"
                className="underline"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setDigestBanner(false)}
              >
                Dismiss
              </button>
            </div>
          )}
          {offline && (
            <div
              role="status"
              data-testid="offline-banner"
              className="border-b px-4 py-2 text-xs font-semibold flex items-center gap-3"
              style={{
                backgroundColor: "rgba(248, 81, 73, 0.12)",
                borderColor: "var(--border-default)",
                color: "var(--accent-red)",
              }}
            >
              <span>Offline · showing cache</span>
              <button
                type="button"
                className="underline"
                style={{ color: "var(--accent-blue, #58a6ff)" }}
                onClick={() => void retryConnection()}
              >
                Retry
              </button>
            </div>
          )}
          {pendingCount > 0 && (
            <div
              role="status"
              data-testid="pending-writes-banner"
              className="border-b px-4 py-2 text-xs font-semibold flex items-center gap-3"
              style={{
                backgroundColor: "rgba(56, 139, 253, 0.12)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              <span>
                {pendingCount} pending write{pendingCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="underline disabled:opacity-50"
                style={{ color: "var(--accent-blue, #58a6ff)" }}
                disabled={flushing}
                onClick={() => void retry()}
              >
                {flushing ? "Retrying…" : "Retry"}
              </button>
              <button
                type="button"
                className="underline disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
                disabled={flushing}
                onClick={() => discardAll()}
              >
                Discard
              </button>
            </div>
          )}
          {rateLimitHit && (
            <div
              role="status"
              className="border-b px-4 py-2 text-xs font-semibold"
              style={{
                backgroundColor: "rgba(251, 191, 36, 0.12)",
                borderColor: "var(--border-default)",
                color: "var(--accent-amber, #fbbf24)",
              }}
            >
              GitHub API rate limit low ({rateLimitHit.remaining} remaining). Sync paused until{" "}
              {new Date(rateLimitHit.reset * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </div>
          )}
          {pushSyncEnabled && !rateLimitHit && (
            <div
              role="status"
              data-testid="push-assisted-banner"
              className="border-b px-4 py-2 text-xs"
              style={{
                backgroundColor: "rgba(56, 139, 253, 0.1)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              Push-assisted sync is on: no GitHub webhooks — freshness comes from sync-on-focus and
              a shorter poll while focused.
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">{main}</div>
          <SyncStatusBar />
        </main>
        {secondary && (
          <aside
            className="h-full overflow-y-auto border-l"
            style={{ borderColor: "var(--border-default)" }}
          >
            {secondary}
          </aside>
        )}
      </div>
      <GlobalShortcuts />
      <CommandPalette />
      <ShortcutChips />
      <WatchReposPrompt />
    </NotificationPollingContext.Provider>
  );
}
