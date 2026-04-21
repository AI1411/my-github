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
      id: 1, name: "CI", status: "completed", conclusion: "success",
      headBranch: "main", runNumber: 1, runStartedAt: null,
      updatedAt: "2026-04-21T00:00:00Z",
      htmlUrl: "https://github.com/o/r/actions/runs/1", repo: "o/r",
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([run]);
    const { result } = renderHook(() => useWorkflowRunsQuery("o", "r", null));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));
  });
});
