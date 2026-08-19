import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../../stores/settingsStore";
import { PrFooterBar } from "./PrFooterBar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ event: "APPROVE", reviewState: "approved" }),
}));

describe("PrFooterBar in-app review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ shortcuts: DEFAULT_SHORTCUTS });
  });

  it("submits APPROVE via cmd_submit_pull_review", async () => {
    const onReviewSubmitted = vi.fn();
    render(
      <PrFooterBar
        owner="o"
        repo="r"
        number={7}
        canMerge
        canApprove
        htmlUrl="https://github.com/o/r/pull/7"
        onReviewSubmitted={onReviewSubmitted}
      />,
    );
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_submit_pull_review", {
        owner: "o",
        repo: "r",
        number: 7,
        event: "APPROVE",
        body: null,
      });
    });
    expect(onReviewSubmitted).toHaveBeenCalledWith("APPROVE", "approved");
  });

  it("submits APPROVE via approvePull shortcut when canApprove", async () => {
    render(
      <PrFooterBar
        owner="o"
        repo="r"
        number={7}
        canMerge
        canApprove
        htmlUrl="https://github.com/o/r/pull/7"
      />,
    );
    fireEvent.keyDown(window, { key: "a" });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_submit_pull_review", {
        owner: "o",
        repo: "r",
        number: 7,
        event: "APPROVE",
        body: null,
      });
    });
  });

  it("does not submit APPROVE via shortcut when canApprove is false", () => {
    render(
      <PrFooterBar
        owner="o"
        repo="r"
        number={7}
        canMerge={false}
        canApprove={false}
        htmlUrl="https://github.com/o/r/pull/7"
      />,
    );
    fireEvent.keyDown(window, { key: "a" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("disables approve actions when canApprove is false", () => {
    render(
      <PrFooterBar
        owner="o"
        repo="r"
        number={7}
        canMerge={false}
        canApprove={false}
        approveDisabledReason="You cannot review your own pull request"
        htmlUrl="https://github.com/o/r/pull/7"
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeDisabled();
  });

  it("merges via cmd_merge_pull", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const onMerged = vi.fn();
    render(
      <PrFooterBar
        owner="o"
        repo="r"
        number={7}
        canMerge
        canApprove
        canClose
        htmlUrl="https://github.com/o/r/pull/7"
        onMerged={onMerged}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_merge_pull", {
        owner: "o",
        repo: "r",
        number: 7,
        mergeMethod: "merge",
      });
    });
    expect(onMerged).toHaveBeenCalled();
  });
});
