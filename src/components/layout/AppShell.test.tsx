import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("../../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));
vi.mock("../../features/activity/useNotificationPolling", () => ({
  useNotificationPolling: notificationLifecycle.useNotificationPolling,
}));
vi.mock("../../lib/notifications", () => ({
  registerAppNotificationClickHandler: notificationLifecycle.registerAppNotificationClickHandler,
}));

describe("AppShell offline banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationLifecycle.registerAppNotificationClickHandler.mockResolvedValue(
      notificationLifecycle.disposeClickHandler,
    );
    useUiStore.setState({ offline: false, sidebarCollapsed: false });
  });

  it("shows an offline banner when uiStore is offline", () => {
    useUiStore.setState({ offline: true });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Offline")).toBeInTheDocument();
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
