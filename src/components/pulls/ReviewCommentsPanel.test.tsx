import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("ReviewCommentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_list_pull_review_comments") {
        return Promise.resolve([
          {
            id: 1,
            userLogin: "alice",
            body: "```suggestion\nx = 1\n```",
            path: "a.ts",
            htmlUrl: "https://github.com/o/r/pull/1#discussion_r1",
            createdAt: "2026-08-15T00:00:00Z",
            inReplyToId: null,
            hasSuggestion: true,
            line: 3,
          },
        ]);
      }
      return Promise.resolve(null);
    });
  });

  it("loads threads and replies", async () => {
    render(<ReviewCommentsPanel owner="o" repo="r" number={1} />);
    expect(await screen.findByText("alice")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reply to comment 1"), {
      target: { value: "thanks" },
    });
    fireEvent.click(screen.getByText("Reply"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_reply_pull_review_comment", {
        owner: "o",
        repo: "r",
        number: 1,
        commentId: 1,
        body: "thanks",
      });
    });
  });

  it("applies suggestion", async () => {
    render(<ReviewCommentsPanel owner="o" repo="r" number={1} />);
    expect(await screen.findByText("Apply suggestion")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply suggestion"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_apply_pull_suggestion", {
        owner: "o",
        repo: "r",
        number: 1,
        commentId: 1,
      });
    });
  });
});
