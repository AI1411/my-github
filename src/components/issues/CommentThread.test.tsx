import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentThread } from "./CommentThread";
import type { IssueCommentSummary } from "../../features/issues/useIssueCommentsQuery";

const make = (
  id: number,
  login: string,
  body: string,
  assoc: string | null,
): IssueCommentSummary => ({
  id,
  author: { login, avatarUrl: "" },
  body,
  createdAt: "2026-04-21T00:00:00Z",
  updatedAt: "2026-04-21T00:00:00Z",
  htmlUrl: "x",
  authorAssociation: assoc,
});

describe("CommentThread", () => {
  it("renders one card per comment", () => {
    render(
      <CommentThread
        comments={[
          make(1, "alice", "first", "OWNER"),
          make(2, "bob", "second", null),
        ]}
      />,
    );
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("shows the Author badge for OWNER association", () => {
    render(
      <CommentThread comments={[make(1, "alice", "x", "OWNER")]} />,
    );
    expect(screen.getByText("Author")).toBeInTheDocument();
  });

  it("shows the Collaborator badge for COLLABORATOR association", () => {
    render(
      <CommentThread comments={[make(1, "alice", "x", "COLLABORATOR")]} />,
    );
    expect(screen.getByText("Collaborator")).toBeInTheDocument();
  });

  it("shows the Maintainer badge for MEMBER association", () => {
    render(
      <CommentThread comments={[make(1, "alice", "x", "MEMBER")]} />,
    );
    expect(screen.getByText("Maintainer")).toBeInTheDocument();
  });

  it("shows the empty fallback when there are no comments", () => {
    render(<CommentThread comments={[]} />);
    expect(screen.getByText(/no comments/i)).toBeInTheDocument();
  });
});
