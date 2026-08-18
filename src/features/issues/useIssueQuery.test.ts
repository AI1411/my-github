import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useIssueQuery } from "./useIssueQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useIssueQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes cmd_get_issue with parsed args", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      number: 1,
      title: "x",
      repo: "o/r",
      author: "a",
      state: "open",
      labels: [],
      assignees: [],
      milestone: null,
      comments: 0,
      updatedAt: "2026-04-21T00:00:00Z",
      htmlUrl: "x",
      body: "hi",
    });
    renderHook(() => useIssueQuery("o", "r", 1));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_issue", {
        owner: "o",
        repo: "r",
        number: 1,
      });
    });
  });

  it("does not invoke when number is undefined", async () => {
    renderHook(() => useIssueQuery("o", "r", undefined));
    await new Promise((r) => setTimeout(r, 0));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("clears issue when params change before the new response arrives", async () => {
    let resolveFirst!: (value: unknown) => void;
    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 2,
      number: 2,
      title: "New issue",
      repo: "o/r",
      author: "a",
      state: "open",
      labels: [],
      assignees: [],
      milestone: null,
      comments: 0,
      updatedAt: "2026-04-21T00:00:00Z",
      htmlUrl: "x",
      body: "hi",
    });

    const { result, rerender } = renderHook(
      ({ owner, repo, number }) => useIssueQuery(owner, repo, number),
      { initialProps: { owner: "o", repo: "r", number: 1 } },
    );

    rerender({ owner: "o", repo: "r", number: 2 });
    expect(result.current.issue).toBeNull();

    await waitFor(() => {
      expect(result.current.issue?.title).toBe("New issue");
    });

    resolveFirst({
      id: 1,
      number: 1,
      title: "Stale issue",
      repo: "o/r",
      author: "a",
      state: "open",
      labels: [],
      assignees: [],
      milestone: null,
      comments: 0,
      updatedAt: "2026-04-21T00:00:00Z",
      htmlUrl: "x",
      body: "hi",
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.issue?.title).toBe("New issue");
  });
});
