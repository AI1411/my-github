import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useIssuesQuery } from "./useIssuesQuery";
import { useDataStore } from "../../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("useIssuesQuery", () => {
  beforeEach(() => {
    useDataStore.getState().reset();
    vi.clearAllMocks();
  });

  it("calls cmd_list_issues with the supplied filter", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderHook(() => useIssuesQuery({ labels: [], state: "open" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_list_issues", {
        filter: { labels: [], state: "open" },
      });
    });
  });

  it("stores fetched issues in dataStore", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        number: 1,
        title: "bug",
        repo: "o/r",
        author: "alice",
        state: "open",
        labels: [],
        assignees: [],
        milestone: null,
        comments: 0,
        updatedAt: "2026-04-21T00:00:00Z",
        htmlUrl: "https://x",
        body: null,
      },
    ]);
    renderHook(() => useIssuesQuery({ labels: [] }));
    await waitFor(() => {
      expect(useDataStore.getState().issues.length).toBe(1);
    });
    expect(useDataStore.getState().issues[0].title).toBe("bug");
  });

  it("captures errors from invoke", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue("boom");
    const { result } = renderHook(() => useIssuesQuery({ labels: [] }));
    await waitFor(() => {
      expect(result.current.error).toBe("boom");
    });
  });
});
