import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { PrFooterBar } from "./PrFooterBar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ event: "APPROVE", reviewState: "approved" }),
}));

describe("PrFooterBar in-app review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("shows error and retry when invoke fails", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Permission denied (403)"),
    );
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
    fireEvent.click(screen.getByText("Approve"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied (403)");
    expect(screen.getByText("Retry")).toBeInTheDocument();
    expect(screen.getByText("Open on GitHub")).toBeInTheDocument();
  });
});
