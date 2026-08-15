import { useEffect, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { NotificationPollingContext } from "../../features/activity/NotificationPollingContext";
import { useNotificationPolling } from "../../features/activity/useNotificationPolling";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useFocusResumeRevalidate } from "../../hooks/useFocusResumeRevalidate";
import { loadDigestLastSeen, shouldShowDigest } from "../../lib/digest";
import { registerAppNotificationClickHandler } from "../../lib/notifications";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { CommandPalette } from "../command/CommandPalette";
import { ShortcutChips } from "../common/ShortcutChips";

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
  const navigate = useNavigate();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const offline = useUiStore((s) => s.offline);
  const rateLimitHit = useUiStore((s) => s.rateLimitHit);
  const setRateLimitHit = useUiStore((s) => s.setRateLimitHit);
  const pushSyncEnabled = useSettingsStore((s) => s.pushSyncEnabled);

  // トレイメニューの "Open Inbox" でInboxへ遷移する
  useEffect(() => {
    const unlisten = listen("tray-open-inbox", () => navigate("/inbox"));
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [navigate]);

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

  // 起動時、前回のダイジェスト表示から間が空いていればDigestを開く
  useEffect(() => {
    const { digestAutoShowEnabled } = useSettingsStore.getState();
    if (!digestAutoShowEnabled) return;
    if (shouldShowDigest(loadDigestLastSeen(), new Date())) {
      navigate("/digest");
    }
    // 起動時に一度だけ判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <main className="h-full overflow-y-auto">
          {offline && (
            <div
              className="border-b px-4 py-2 text-xs font-semibold"
              style={{
                backgroundColor: "rgba(248, 81, 73, 0.12)",
                borderColor: "var(--border-default)",
                color: "var(--accent-red)",
              }}
            >
              Offline
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
              Push-assisted sync is on: no GitHub webhooks — freshness comes from sync-on-focus
              and a shorter poll while focused.
            </div>
          )}
          {main}
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
      <CommandPalette />
      <ShortcutChips />
    </NotificationPollingContext.Provider>
  );
}
