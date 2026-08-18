import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkflowRunsQuery } from "./useWorkflowRunsQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useWorkflowRunsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls cmd_get_workflow_runs when owner+repo provided", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderHook(() => useWorkflowRunsQuery("octocat", "hello", null));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_workflow_runs", {
        owner: "octocat",
        repo: "hello",
        branch: null,
      });
    });
  });

  it("does not invoke when owner is null", async () => {
    renderHook(() => useWorkflowRunsQuery(null, null, null));
    await new Promise((r) => setTimeout(r, 0));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns runs", async () => {
    const run = {
      id: 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      headBranch: "main",
      runNumber: 1,
      runStartedAt: null,
      updatedAt: "2026-04-21T00:00:00Z",
      htmlUrl: "https://github.com/o/r/actions/runs/1",
      repo: "o/r",
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([run]);
    const { result } = renderHook(() => useWorkflowRunsQuery("o", "r", null));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));
  });

  it("ignores stale responses when owner/repo changes", async () => {
    let resolveFirst!: (value: unknown[]) => void;
    const first = new Promise<unknown[]>((resolve) => {
      resolveFirst = resolve;
    });
    const latest = [
      {
        id: 2,
        name: "Latest",
        status: "completed",
        conclusion: "success",
        headBranch: "main",
        runNumber: 2,
        runStartedAt: null,
        updatedAt: "2026-04-21T00:00:00Z",
        htmlUrl: "https://github.com/o/r2/actions/runs/2",
        repo: "o/r2",
      },
    ];

    (invoke as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(latest);

    const { result, rerender } = renderHook(
      ({ owner, repo }) => useWorkflowRunsQuery(owner, repo, null),
      { initialProps: { owner: "o", repo: "r1" } },
    );

    rerender({ owner: "o", repo: "r2" });
    await waitFor(() => expect(result.current.runs[0]?.name).toBe("Latest"));

    resolveFirst([
      {
        id: 1,
        name: "Stale",
        status: "completed",
        conclusion: "failure",
        headBranch: "main",
        runNumber: 1,
        runStartedAt: null,
        updatedAt: "2026-04-21T00:00:00Z",
        htmlUrl: "https://github.com/o/r1/actions/runs/1",
        repo: "o/r1",
      },
    ]);
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.runs[0]?.name).toBe("Latest");
  });
});
