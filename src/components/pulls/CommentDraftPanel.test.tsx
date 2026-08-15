import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { CommentDraftPanel } from "./CommentDraftPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ event: "COMMENT", reviewState: null }),
}));

const copyToClipboardMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/checkout", () => ({ copyToClipboard: copyToClipboardMock }));

const baseProps = {
  owner: "o",
  repo: "r",
  number: 1,
  htmlUrl: null as string | null,
};

describe("CommentDraftPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(true);
  });

  it("renders all five prefixes", () => {
    render(<CommentDraftPanel {...baseProps} />);
    for (const label of ["[must]", "[imo]", "[nits]", "[ask]", "[fyi]"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("copies the draft with the selected prefix", async () => {
    render(<CommentDraftPanel {...baseProps} />);
    fireEvent.click(screen.getByText("[must]"));
    fireEvent.change(screen.getByLabelText("Comment body"), {
      target: { value: "境界値のテストを足してください" },
    });
    fireEvent.click(screen.getByText("Copy draft"));
    await waitFor(() =>
      expect(copyToClipboardMock).toHaveBeenCalledWith("[must] 境界値のテストを足してください"),
    );
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("defaults to the imo prefix", async () => {
    render(<CommentDraftPanel {...baseProps} />);
    fireEvent.click(screen.getByText("Copy draft"));
    await waitFor(() => expect(copyToClipboardMock).toHaveBeenCalledWith("[imo]"));
  });

  it("hides Open in browser without a URL", () => {
    render(<CommentDraftPanel {...baseProps} htmlUrl={null} />);
    expect(screen.queryByText("Open in browser")).not.toBeInTheDocument();
  });

  it("shows Open in browser with a URL", () => {
    render(<CommentDraftPanel {...baseProps} htmlUrl="https://github.com/o/r/pull/1" />);
    expect(screen.getByText("Open in browser")).toBeInTheDocument();
  });

  it("submits a COMMENT review via cmd_submit_pull_review", async () => {
    render(<CommentDraftPanel {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Comment body"), {
      target: { value: "LGTM with notes" },
    });
    fireEvent.click(screen.getByText("Submit comment"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_submit_pull_review", {
        owner: "o",
        repo: "r",
        number: 1,
        event: "COMMENT",
        body: "[imo] LGTM with notes",
      });
    });
  });
});
