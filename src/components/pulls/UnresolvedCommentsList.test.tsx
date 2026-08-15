import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { UnresolvedCommentsList } from "./UnresolvedCommentsList";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("UnresolvedCommentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_list_pull_review_comments") {
        return Promise.resolve([
          {
            id: 1,
            userLogin: "alice",
            body: "Please fix the null check here",
            path: "src/app.ts",
            htmlUrl: "https://github.com/o/r/pull/1#discussion_r1",
            createdAt: "2026-08-15T00:00:00Z",
            inReplyToId: null,
            hasSuggestion: false,
            line: 42,
          },
          {
            id: 2,
            userLogin: "bob",
            body: "Agreed",
            path: "src/app.ts",
            htmlUrl: "https://github.com/o/r/pull/1#discussion_r2",
            createdAt: "2026-08-15T01:00:00Z",
            inReplyToId: 1,
            hasSuggestion: false,
            line: 42,
          },
          {
            id: 3,
            userLogin: "carol",
            body: "Rename this helper",
            path: "src/util.ts",
            htmlUrl: "https://github.com/o/r/pull/1#discussion_r3",
            createdAt: "2026-08-15T02:00:00Z",
            inReplyToId: null,
            hasSuggestion: false,
            line: 10,
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it("lists unresolved root threads with path:line", async () => {
    render(<UnresolvedCommentsList owner="o" repo="r" number={1} />);
    expect(await screen.findByText("src/app.ts:42")).toBeInTheDocument();
    expect(screen.getByText("src/util.ts:10")).toBeInTheDocument();
    expect(screen.getAllByText("Unresolved")).toHaveLength(2);
    expect(screen.queryByText("Agreed")).not.toBeInTheDocument();
  });

  it("invokes onJumpToFile when a thread is clicked", async () => {
    const onJumpToFile = vi.fn();
    render(
      <UnresolvedCommentsList owner="o" repo="r" number={1} onJumpToFile={onJumpToFile} />,
    );
    const jumpTarget = await screen.findByText("src/util.ts:10");
    fireEvent.click(jumpTarget.closest("button")!);
    expect(onJumpToFile).toHaveBeenCalledWith("src/util.ts");
  });

  it("notifies parent when comments load", async () => {
    const onCommentsLoaded = vi.fn();
    render(
      <UnresolvedCommentsList
        owner="o"
        repo="r"
        number={1}
        onCommentsLoaded={onCommentsLoaded}
      />,
    );
    await waitFor(() => {
      expect(onCommentsLoaded).toHaveBeenCalled();
    });
    const list = onCommentsLoaded.mock.calls[0][0] as unknown[];
    expect(list).toHaveLength(3);
  });
});
