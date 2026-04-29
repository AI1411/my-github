import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { sendPulseNotification } from "../../lib/notifications";
import { useDataStore } from "../../stores/dataStore";
import {
  DEFAULT_SHORTCUTS,
  useSettingsStore,
} from "../../stores/settingsStore";
import { useNotificationsQuery } from "./useNotificationsQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../lib/notifications", () => ({
  sendPulseNotification: vi.fn().mockResolvedValue(true),
}));

describe("useNotificationsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataStore.getState().reset();
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

  it("calls cmd_get_notifications on mount", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderHook(() => useNotificationsQuery());
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_notifications");
    });
  });

  it("returns notifications", async () => {
    const mock = [{
      id: "1", reason: "mention", repo: "o/r", subjectTitle: "Hey",
      subjectType: "Issue", htmlUrl: null, unread: true, updatedAt: "2026-04-21T00:00:00Z",
    }];
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    const { result } = renderHook(() => useNotificationsQuery());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
  });

  it("syncs notifications to dataStore and sends unread desktop notifications", async () => {
    const mock = [{
      id: "review-1", reason: "review_requested", repo: "o/r", subjectTitle: "Review",
      subjectType: "PullRequest", htmlUrl: "https://github.com/o/r/pull/1", unread: true, updatedAt: "2026-04-21T00:00:00Z",
    }];
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    renderHook(() => useNotificationsQuery());

    await waitFor(() => expect(useDataStore.getState().notifications).toEqual(mock));
    expect(sendPulseNotification).toHaveBeenCalledWith(
      mock[0],
      useSettingsStore.getState().notificationSettings,
    );
  });

  it("captures errors", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("fail");
    const { result } = renderHook(() => useNotificationsQuery());
    await waitFor(() => expect(result.current.error).toBe("fail"));
  });
});
