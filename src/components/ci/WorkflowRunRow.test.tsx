import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkflowRunRow } from "./WorkflowRunRow";
import type { WorkflowRunSummary } from "../../stores/dataStore";

const run: WorkflowRunSummary = {
  id: 100, name: "CI Build", status: "completed", conclusion: "failure",
  headBranch: "main", runNumber: 7, runStartedAt: "2026-04-21T00:00:00Z",
  updatedAt: "2026-04-21T00:05:00Z",
  htmlUrl: "https://github.com/o/r/actions/runs/100", repo: "o/r",
};

describe("WorkflowRunRow", () => {
  it("renders workflow name", () => {
    render(<WorkflowRunRow run={run} />);
    expect(screen.getByText("CI Build")).toBeInTheDocument();
  });

  it("renders branch and run number", () => {
    render(<WorkflowRunRow run={run} />);
    expect(screen.getByText(/main/)).toBeInTheDocument();
    expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it("shows failure status icon", () => {
    render(<WorkflowRunRow run={run} />);
    expect(screen.getByLabelText("failure")).toBeInTheDocument();
  });

  it("shows success status icon", () => {
    render(<WorkflowRunRow run={{ ...run, conclusion: "success" }} />);
    expect(screen.getByLabelText("success")).toBeInTheDocument();
  });

  it("shows in-progress status for non-completed", () => {
    render(<WorkflowRunRow run={{ ...run, status: "in_progress", conclusion: null }} />);
    expect(screen.getByLabelText("in-progress")).toBeInTheDocument();
  });

  it("renders Logs button on failure when onOpenLogs provided", () => {
    const handler = vi.fn();
    render(<WorkflowRunRow run={run} onOpenLogs={handler} />);
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  it("calls onOpenLogs when Logs button is clicked", () => {
    const handler = vi.fn();
    render(<WorkflowRunRow run={run} onOpenLogs={handler} />);
    fireEvent.click(screen.getByText("Logs"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not render Logs button without onOpenLogs", () => {
    render(<WorkflowRunRow run={run} />);
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();
  });
});
