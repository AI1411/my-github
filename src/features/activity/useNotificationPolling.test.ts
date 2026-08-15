import { act, renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendAppNotification } from "../../lib/notifications";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore, type NotificationSummary } from "../../stores/dataStore";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../../stores/settingsStore";
import { useNotificationPolling, type NotificationPollingState } from "./useNotificationPolling";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../lib/notifications", () => ({
  sendAppNotification: vi.fn().mockResolvedValue(true),
}));

const invokeMock = vi.mocked(invoke);
const sendAppNotificationMock = vi.mocked(sendAppNotification);

const unreadNotification: NotificationSummary = {
  id: "review-1",
  reason: "review_requested",
  repo: "AI1411/my-github",
  subjectTitle: "Review this PR",
  subjectType: "PullRequest",
  htmlUrl: "https://github.com/AI1411/my-github/pull/1",
  unread: true,
  updatedAt: "2026-07-16T00:00:00Z",
};

const secondUnreadNotification: NotificationSummary = {
  ...unreadNotification,
  id: "review-2",
  subjectTitle: "Review another PR",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useNotificationPolling", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: "token",
      status: "authenticated",
    });
    useDataStore.getState().reset();
    useSettingsStore.setState({
      watchedRepositories: [],
      notificationSettings: {
        enabled: true,
        ciFailures: "immediate",
        reviewRequests: "immediate",
        mentions: "immediate",
      },
      pollingInterval: "30s",
      pushSyncEnabled: false,
      dockBadgeEnabled: true,
      density: "comfortable",
      theme: "dark",
      layout: "inbox-first",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("fetches immediately and again at the configured interval", async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValue([]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("cmd_get_notifications"));

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
  });

  it("delivers an unread notification once across repeated polls", async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValue([unreadNotification]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(1));
    expect(sendAppNotificationMock).toHaveBeenCalledWith(
      unreadNotification,
      useSettingsStore.getState().notificationSettings,
      useSettingsStore.getState().repoNotificationRules,
      useSettingsStore.getState().notificationRules,
    );

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(sendAppNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a retrieval failure on the next interval", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(result.current.error).toBe("Error: offline"));

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBeNull();
  });

  it("reschedules when pollingInterval changes", async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValue([]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      useSettingsStore.getState().setPollingInterval("60s");
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(invokeMock).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
  });

  it("uses a 30s poll when push-assisted sync is on and focused", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    useSettingsStore.setState({ pollingInterval: "60s", pushSyncEnabled: true });
    invokeMock.mockResolvedValue([]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
  });

  it("clears deduplication when the account changes", async () => {
    invokeMock.mockResolvedValue([unreadNotification]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      useAuthStore.getState().setUser({ login: "hubot", avatar_url: "" });
    });

    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(2));
  });

  it("stops polling and ignores an in-flight result after unmount", async () => {
    vi.useFakeTimers();
    let resolveRequest: (notifications: NotificationSummary[]) => void;
    invokeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => resolveRequest([unreadNotification]));
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(useDataStore.getState().notifications).toEqual([]);
    expect(sendAppNotificationMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("stops stale delivery when the account changes during notification sending", async () => {
    useSettingsStore.getState().setPollingInterval("off");
    let resolveSend!: (sent: boolean) => void;
    sendAppNotificationMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    invokeMock
      .mockResolvedValueOnce([unreadNotification, secondUnreadNotification])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unreadNotification]);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      useAuthStore.getState().setUser({ login: "hubot", avatar_url: "" });
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    await act(async () => resolveSend(true));

    await act(async () => result.current.refetch());
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(2));
    expect(sendAppNotificationMock).toHaveBeenNthCalledWith(
      2,
      unreadNotification,
      useSettingsStore.getState().notificationSettings,
      useSettingsStore.getState().repoNotificationRules,
      useSettingsStore.getState().notificationRules,
    );
  });

  it("does not send duplicates when refetch calls overlap", async () => {
    useSettingsStore.getState().setPollingInterval("off");
    invokeMock.mockResolvedValueOnce([]).mockResolvedValue([unreadNotification]);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.refetch();
      result.current.refetch();
    });

    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(1));
  });

  it("keeps the newer response when overlapping requests resolve in reverse order", async () => {
    useSettingsStore.getState().setPollingInterval("off");
    invokeMock.mockResolvedValueOnce([]);
    const older = deferred<NotificationSummary[]>();
    const newer = deferred<NotificationSummary[]>();
    invokeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.refetch();
      result.current.refetch();
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    await act(async () => newer.resolve([secondUnreadNotification]));
    await act(async () => older.resolve([unreadNotification]));

    expect(useDataStore.getState().notifications).toEqual([secondUnreadNotification]);
  });

  it("does not restore an older error after a newer overlapping request succeeds", async () => {
    useSettingsStore.getState().setPollingInterval("off");
    invokeMock.mockResolvedValueOnce([]);
    const older = deferred<NotificationSummary[]>();
    const newer = deferred<NotificationSummary[]>();
    invokeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.refetch();
      result.current.refetch();
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    await act(async () => newer.resolve([secondUnreadNotification]));
    await act(async () => older.reject(new Error("stale failure")));

    expect(result.current.error).toBeNull();
  });

  it("stays loading until the newest overlapping request completes", async () => {
    useSettingsStore.getState().setPollingInterval("off");
    invokeMock.mockResolvedValueOnce([]);
    const older = deferred<NotificationSummary[]>();
    const newer = deferred<NotificationSummary[]>();
    invokeMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    let result!: { current: NotificationPollingState };
    await act(async () => {
      ({ result } = renderHook(() => useNotificationPolling()));
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.refetch();
      result.current.refetch();
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    await act(async () => older.resolve([unreadNotification]));
    expect(result.current.loading).toBe(true);

    await act(async () => newer.resolve([secondUnreadNotification]));
    expect(result.current.loading).toBe(false);
  });

  it("keeps successful delivery deduplication when the polling interval changes", async () => {
    vi.useFakeTimers();
    let resolveSend!: (sent: boolean) => void;
    sendAppNotificationMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    invokeMock.mockResolvedValue([unreadNotification]);

    await act(async () => {
      renderHook(() => useNotificationPolling());
    });
    await vi.waitFor(() => expect(sendAppNotificationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      useSettingsStore.getState().setPollingInterval("60s");
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    await act(async () => resolveSend(true));

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(3));
    expect(sendAppNotificationMock).toHaveBeenCalledTimes(1);
  });
});
