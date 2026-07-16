import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommentDraftPanel } from "./CommentDraftPanel";

const copyToClipboardMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/checkout", () => ({ copyToClipboard: copyToClipboardMock }));

describe("CommentDraftPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(true);
  });

  it("renders all five prefixes", () => {
    render(<CommentDraftPanel htmlUrl={null} />);
    for (const label of ["[must]", "[imo]", "[nits]", "[ask]", "[fyi]"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("copies the draft with the selected prefix", async () => {
    render(<CommentDraftPanel htmlUrl={null} />);
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
    render(<CommentDraftPanel htmlUrl={null} />);
    fireEvent.click(screen.getByText("Copy draft"));
    await waitFor(() => expect(copyToClipboardMock).toHaveBeenCalledWith("[imo]"));
  });

  it("hides Open in browser without a URL", () => {
    render(<CommentDraftPanel htmlUrl={null} />);
    expect(screen.queryByText("Open in browser")).not.toBeInTheDocument();
  });

  it("shows Open in browser with a URL", () => {
    render(<CommentDraftPanel htmlUrl="https://github.com/o/r/pull/1" />);
    expect(screen.getByText("Open in browser")).toBeInTheDocument();
  });
});
