import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDigestLastSeen } from "../../lib/digest";
import type { WriteQueueEntry } from "../../lib/writeQueue";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { AppShell } from "./AppShell";

const notificationLifecycle = vi.hoisted(() => ({
  disposeClickHandler: vi.fn(),
  registerAppNotificationClickHandler: vi.fn(),
  useNotificationPolling: vi.fn(() => ({
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

const writeQueueMock = vi.hoisted(() => ({
  useWriteQueue: vi.fn(
    (): {
      queue: WriteQueueEntry[];
      pendingCount: number;
      flushing: boolean;
      retry: ReturnType<typeof vi.fn>;
      discard: ReturnType<typeof vi.fn>;
      discardAll: ReturnType<typeof vi.fn>;
    } => ({
      queue: [],
      pendingCount: 0,
      flushing: false,
      retry: vi.fn(),
      discard: vi.fn(),
      discardAll: vi.fn(),
    }),
  ),
}));

vi.mock("../../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));
vi.mock("../../hooks/useWriteQueue", () => ({
  useWriteQueue: writeQueueMock.useWriteQueue,
}));
vi.mock("../../features/activity/useNotificationPolling", () => ({
  useNotificationPolling: notificationLifecycle.useNotificationPolling,
}));
vi.mock("../../lib/notifications", () => ({
  registerAppNotificationClickHandler: notificationLifecycle.registerAppNotificationClickHandler,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => undefined)),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ lastRateLimit: null }),
  isTauri: vi.fn(() => true),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

describe("AppShell offline banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeQueueMock.useWriteQueue.mockReturnValue({
      queue: [],
      pendingCount: 0,
      flushing: false,
      retry: vi.fn(),
      discard: vi.fn(),
      discardAll: vi.fn(),
    });
    notificationLifecycle.registerAppNotificationClickHandler.mockResolvedValue(
      notificationLifecycle.disposeClickHandler,
    );
    useUiStore.setState({ offline: false, sidebarCollapsed: false, rateLimitHit: null });
    useSettingsStore.setState({
      pushSyncEnabled: false,
      digestAutoShowEnabled: true,
      watchOnboardingDismissed: true,
    });
  });

  it("shows an offline banner when uiStore is offline", () => {
    useUiStore.setState({ offline: true });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("offline-banner")).toHaveTextContent("Offline · showing cache");
    expect(screen.getByTestId("offline-banner")).toHaveAttribute("role", "status");
  });

  it("retries ping and sync from the offline banner", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "cmd_ping") return true;
      if (cmd === "cmd_sync_now") return null;
      return { lastRateLimit: null };
    });
    useUiStore.setState({ offline: true });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_ping");
      expect(invoke).toHaveBeenCalledWith("cmd_sync_now");
    });
  });

  it("marks auth expired when sync emits auth-expired", async () => {
    const { listen } = await import("@tauri-apps/api/event");
    let authExpiredHandler: (() => void) | undefined;
    (listen as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string, handler: () => void) => {
        if (event === "auth-expired") authExpiredHandler = handler;
        return Promise.resolve(() => undefined);
      },
    );
    useAuthStore.setState({ status: "authenticated", user: { login: "octo", avatar_url: "" } });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(authExpiredHandler).toBeDefined();
    act(() => authExpiredHandler?.());
    expect(useAuthStore.getState().status).toBe("expired");
  });

  it("shows a pending writes banner with Retry when the queue is non-empty", () => {
    const retry = vi.fn();
    writeQueueMock.useWriteQueue.mockReturnValue({
      queue: [
        {
          id: "1",
          command: "cmd_update_issue",
          args: { owner: "o", repo: "r", number: 1 },
          createdAt: 1,
        },
      ] satisfies WriteQueueEntry[],
      pendingCount: 2,
      flushing: false,
      retry,
      discard: vi.fn(),
      discardAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("pending-writes-banner")).toHaveTextContent("2 pending writes");
    screen.getByRole("button", { name: "Retry" }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows a rate limit banner when uiStore has rateLimitHit", () => {
    useUiStore.setState({
      rateLimitHit: { remaining: 12, reset: Math.floor(Date.now() / 1000) + 3600 },
    });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/rate limit low \(12 remaining\)/i)).toBeInTheDocument();
  });

  it("shows a push-assisted banner when the setting is enabled", () => {
    useSettingsStore.setState({ pushSyncEnabled: true });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("push-assisted-banner")).toHaveTextContent(/no GitHub webhooks/i);
  });

  it("starts notification polling and click handling without mounting Activity", () => {
    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(notificationLifecycle.useNotificationPolling).toHaveBeenCalledTimes(1);
    expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
  });

  it("disposes notification click handling when AppShell unmounts", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(notificationLifecycle.disposeClickHandler).toHaveBeenCalledTimes(1);
  });

  it("retries notification click handling after registration fails", async () => {
    vi.useFakeTimers();
    notificationLifecycle.registerAppNotificationClickHandler
      .mockRejectedValueOnce(new Error("not ready"))
      .mockResolvedValueOnce(notificationLifecycle.disposeClickHandler);

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );
    await vi.waitFor(() => {
      expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
    });

    await act(() => vi.runOnlyPendingTimersAsync());

    expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("stops retrying notification click handling after unmount", async () => {
    vi.useFakeTimers();
    notificationLifecycle.registerAppNotificationClickHandler.mockRejectedValue(
      new Error("not ready"),
    );

    const { unmount } = render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );
    await vi.waitFor(() => {
      expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
    });
    unmount();

    await act(() => vi.runOnlyPendingTimersAsync());

    expect(notificationLifecycle.registerAppNotificationClickHandler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("AppShell startup digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    notificationLifecycle.registerAppNotificationClickHandler.mockResolvedValue(
      notificationLifecycle.disposeClickHandler,
    );
    useUiStore.setState({ offline: false, sidebarCollapsed: false, rateLimitHit: null });
    useSettingsStore.setState({ digestAutoShowEnabled: true });
  });

  it("shows a Digest banner instead of navigating away from inbox", async () => {
    saveDigestLastSeen(new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString());

    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Routes>
          <Route
            path="*"
            element={
              <AppShell
                sidebar={<div />}
                main={
                  <>
                    <LocationProbe />
                    <div>Main</div>
                  </>
                }
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("digest-ready-banner")).toHaveTextContent("Digest is ready");
    });
    expect(screen.getByRole("link", { name: "Open Digest" })).toHaveAttribute("href", "/digest");
    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
  });

  it("dismisses the Digest banner without navigating", async () => {
    saveDigestLastSeen(new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString());

    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Routes>
          <Route
            path="*"
            element={
              <AppShell
                sidebar={<div />}
                main={
                  <>
                    <LocationProbe />
                    <div>Main</div>
                  </>
                }
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("digest-ready-banner")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      expect(screen.queryByTestId("digest-ready-banner")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
  });

  it("stays on inbox when auto digest is disabled", async () => {
    useSettingsStore.setState({ digestAutoShowEnabled: false });
    saveDigestLastSeen(new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString());

    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Routes>
          <Route
            path="*"
            element={
              <AppShell
                sidebar={<div />}
                main={
                  <>
                    <LocationProbe />
                    <div>Main</div>
                  </>
                }
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
    expect(screen.queryByTestId("digest-ready-banner")).not.toBeInTheDocument();
  });
});
