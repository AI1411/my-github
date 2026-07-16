import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../../stores/uiStore";
import { AppShell } from "./AppShell";

const notificationLifecycle = vi.hoisted(() => ({
  registerAppNotificationClickHandler: vi.fn().mockResolvedValue(undefined),
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
});
