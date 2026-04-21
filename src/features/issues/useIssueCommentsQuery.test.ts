import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useIssueCommentsQuery } from "./useIssueCommentsQuery";

describe("useIssueCommentsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes cmd_list_issue_comments with parsed args", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderHook(() => useIssueCommentsQuery("octocat", "alpha", 7));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_list_issue_comments", {
        owner: "octocat",
        repo: "alpha",
        number: 7,
      });
    });
  });

  it("returns comments on success", async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        author: { login: "a", avatarUrl: "" },
        body: "hi",
        createdAt: "2026-04-21T00:00:00Z",
        updatedAt: "2026-04-21T00:00:00Z",
        htmlUrl: "x",
        authorAssociation: "MEMBER",
      },
    ]);
    const { result } = renderHook(() =>
      useIssueCommentsQuery("o", "r", 1),
    );
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
  });

  it("does not invoke when params are missing", async () => {
    renderHook(() => useIssueCommentsQuery(undefined, undefined, undefined));
    await new Promise((r) => setTimeout(r, 0));
    expect(invoke).not.toHaveBeenCalled();
  });
});
