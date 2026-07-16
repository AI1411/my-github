import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationPollingContext } from "../../features/activity/NotificationPollingContext";
import { useNotificationPolling } from "../../features/activity/useNotificationPolling";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { registerAppNotificationClickHandler } from "../../lib/notifications";
import { useUiStore } from "../../stores/uiStore";
import { CommandPalette } from "../command/CommandPalette";

export interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  secondary?: ReactNode;
}

export function AppShell({ sidebar, main, secondary }: AppShellProps) {
  useOnlineStatus();
  const polling = useNotificationPolling();
  const navigate = useNavigate();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const offline = useUiStore((s) => s.offline);

  useEffect(() => {
    let disposed = false;
    let disposeClickHandler: (() => void) | undefined;
    void registerAppNotificationClickHandler((route) => navigate(route))
      .then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          disposeClickHandler = dispose;
        }
      })
      .catch(() => {
        // Registration can be retried the next time this effect runs.
      });
    return () => {
      disposed = true;
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
    </NotificationPollingContext.Provider>
  );
}
