import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useCrossRepoWorkflowRunsQuery } from "./useCrossRepoWorkflowRunsQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const run = (id: number, repo: string, conclusion: string) => ({
  id,
  name: "CI",
  status: "completed",
  conclusion,
  headBranch: "main",
  runNumber: id,
  runStartedAt: null,
  updatedAt: `2026-04-2${id}T00:00:00Z`,
  htmlUrl: `https://github.com/${repo}/actions/runs/${id}`,
  repo,
});

describe("useCrossRepoWorkflowRunsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches runs from multiple repos and sorts failures first", async () => {
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([run(1, "o/r1", "success")])
      .mockResolvedValueOnce([run(2, "o/r2", "failure")]);

    const { result } = renderHook(() =>
      useCrossRepoWorkflowRunsQuery(["o/r1", "o/r2"], null),
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(2));
    expect(result.current.runs[0]?.conclusion).toBe("failure");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("returns empty when no repos", async () => {
    const { result } = renderHook(() => useCrossRepoWorkflowRunsQuery([], null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.runs).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });
});
