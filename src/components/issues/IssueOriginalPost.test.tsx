import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
