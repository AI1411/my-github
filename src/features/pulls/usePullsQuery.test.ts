import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { usePullsQuery } from "./usePullsQuery";
import { useDataStore } from "../../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const samplePull = {
  id: 1,
  number: 1,
  title: "pull",
  repo: "o/r",
  author: "alice",
  state: "open" as const,
  isDraft: false,
  headRef: "feat",
  baseRef: "main",
  updatedAt: "2026-04-21T00:00:00Z",
  htmlUrl: null,
  ciState: null,
  reviewState: null,
  hasMention: false,
  requestedReviewers: [],
  mergedAt: null,
  additions: null,
  deletions: null,
  changedFiles: null,
};

describe("usePullsQuery", () => {
  beforeEach(() => {
    useDataStore.getState().reset();
    vi.clearAllMocks();
  });

  it("calls cmd_list_pulls with the supplied filter", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderHook(() => usePullsQuery({ tab: "created", state: "open" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_list_pulls", {
        filter: { tab: "created", state: "open" },
      });
    });
  });

  it("stores fetched pulls in dataStore", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([samplePull]);
    renderHook(() => usePullsQuery({ tab: "all" }));
    await waitFor(() => {
      expect(useDataStore.getState().pulls.length).toBe(1);
    });
    expect(useDataStore.getState().pulls[0].title).toBe("pull");
  });

  it("ignores stale responses when the filter changes", async () => {
    let resolveFirst!: (value: typeof samplePull[]) => void;
    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...samplePull, id: 2, title: "Latest pull" },
    ]);

    const { rerender } = renderHook(({ filter }) => usePullsQuery(filter), {
      initialProps: { filter: { tab: "created" as const } },
    });

    rerender({ filter: { tab: "assigned" as const } });

    await waitFor(() => {
      expect(useDataStore.getState().pulls[0]?.title).toBe("Latest pull");
    });

    resolveFirst([{ ...samplePull, title: "Stale pull" }]);

    await new Promise((r) => setTimeout(r, 20));
    expect(useDataStore.getState().pulls[0]?.title).toBe("Latest pull");
  });
});
