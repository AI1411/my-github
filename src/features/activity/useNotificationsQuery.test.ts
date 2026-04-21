import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useNotificationsQuery } from "./useNotificationsQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useNotificationsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("captures errors", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("fail");
    const { result } = renderHook(() => useNotificationsQuery());
    await waitFor(() => expect(result.current.error).toBe("fail"));
  });
});
