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

  it("ignores stale responses when the filter changes", async () => {
    let resolveFirst!: (value: { id: number; title: string }[]) => void;
    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 2,
        number: 2,
        title: "Latest issue",
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

    const { rerender } = renderHook(({ filter }) => useIssuesQuery(filter), {
      initialProps: { filter: { labels: [], state: "open" as const } },
    });

    rerender({ filter: { labels: [], state: "closed" as const } });

    await waitFor(() => {
      expect(useDataStore.getState().issues[0]?.title).toBe("Latest issue");
    });

    resolveFirst([
      {
        id: 1,
        number: 1,
        title: "Stale issue",
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

    await new Promise((r) => setTimeout(r, 20));
    expect(useDataStore.getState().issues[0]?.title).toBe("Latest issue");
  });
});
