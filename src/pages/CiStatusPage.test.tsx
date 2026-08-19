import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import CiStatusPage from "./CiStatusPage";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const failedRun = {
  id: 100,
  name: "CI Build",
  status: "completed",
  conclusion: "failure",
  headBranch: "main",
  runNumber: 7,
  runStartedAt: "2026-04-21T00:00:00Z",
  updatedAt: "2026-04-21T00:05:00Z",
  htmlUrl: "https://github.com/o/r/actions/runs/100",
  repo: "o/r",
};

describe("CiStatusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataStore.setState({ pulls: [], issues: [] });
    useSettingsStore.setState({ watchedRepositories: ["o/r"] });
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_workflow_runs") {
        return Promise.resolve([failedRun]);
      }
      if (cmd === "cmd_rerun_workflow_failed_jobs") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(null);
    });
  });

  it("invokes cmd_rerun_workflow_failed_jobs when Re-run failed is clicked", async () => {
    render(<CiStatusPage />);

    await waitFor(() => {
      expect(screen.getByText("Re-run failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Re-run failed"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_rerun_workflow_failed_jobs", {
        owner: "o",
        repo: "r",
        runId: 100,
      });
    });
  });
});
