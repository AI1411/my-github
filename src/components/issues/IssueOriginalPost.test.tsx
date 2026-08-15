import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueOriginalPost } from "./IssueOriginalPost";

describe("IssueOriginalPost", () => {
  it("renders author login and Author badge", () => {
    render(
      <IssueOriginalPost
        author={{ login: "octocat", avatarUrl: "" }}
        body="Hello *world*"
        createdAt="2026-04-21T00:00:00Z"
      />,
    );
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
  });

  it("renders markdown body", () => {
    render(
      <IssueOriginalPost
        author={{ login: "alice", avatarUrl: "" }}
        body="# Title"
        createdAt="2026-04-21T00:00:00Z"
      />,
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  });

  it("renders no comment fallback when body is empty", () => {
    render(
      <IssueOriginalPost
        author={{ login: "alice", avatarUrl: "" }}
        body={null}
        createdAt="2026-04-21T00:00:00Z"
      />,
    );
    expect(screen.getByText(/no description/i)).toBeInTheDocument();
  });

  it("renders reaction pills and forwards toggle clicks", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <IssueOriginalPost
        author={{ login: "alice", avatarUrl: "" }}
        body="hi"
        createdAt="2026-04-21T00:00:00Z"
        reactions={[
          { content: "+1", count: 1, viewerHasReacted: false },
          { content: "-1", count: 0, viewerHasReacted: false },
          { content: "laugh", count: 0, viewerHasReacted: false },
          { content: "hooray", count: 0, viewerHasReacted: false },
          { content: "confused", count: 0, viewerHasReacted: false },
          { content: "heart", count: 0, viewerHasReacted: false },
          { content: "rocket", count: 0, viewerHasReacted: false },
          { content: "eyes", count: 0, viewerHasReacted: false },
        ]}
        onToggleReaction={onToggle}
      />,
    );
    await user.click(screen.getByRole("button", { name: /\+1 reaction/i }));
    expect(onToggle).toHaveBeenCalledWith("+1");
  });
});
