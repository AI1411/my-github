import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueRow } from "./IssueRow";
import type { IssueSummary } from "../../stores/dataStore";

const sample: IssueSummary = {
  id: 1,
  number: 42,
  title: "Improve docs",
  repo: "octocat/alpha",
  author: "octocat",
  state: "open",
  labels: [{ name: "bug", color: "d73a4a" }],
  assignees: [],
  milestone: null,
  comments: 3,
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
  htmlUrl: null,
  body: null,
};

describe("IssueRow", () => {
  it("shows the number, title and inline labels", () => {
    render(<IssueRow issue={sample} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Improve docs")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
  });

  it("renders an open status dot when state is open", () => {
    render(<IssueRow issue={sample} />);
    expect(screen.getByLabelText("Open")).toBeInTheDocument();
  });

  it("renders a closed status dot when state is closed", () => {
    render(<IssueRow issue={{ ...sample, state: "closed" }} />);
    expect(screen.getByLabelText("Closed")).toBeInTheDocument();
  });

  it("shows comment count and repo meta", () => {
    render(<IssueRow issue={sample} />);
    expect(screen.getByText(/octocat\/alpha/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("highlights when selected", () => {
    const { rerender } = render(<IssueRow issue={sample} selected={false} />);
    const row = screen.getByRole("row");
    const unselectedBg = row.style.backgroundColor;
    rerender(<IssueRow issue={sample} selected={true} />);
    expect(row.style.backgroundColor).not.toBe(unselectedBg);
  });

  it("renders assignee avatar stack", () => {
    render(
      <IssueRow
        issue={{
          ...sample,
          assignees: [
            { login: "alice", avatarUrl: "" },
            { login: "bob", avatarUrl: "" },
          ],
        }}
      />,
    );
    expect(screen.getByTitle("alice")).toBeInTheDocument();
    expect(screen.getByTitle("bob")).toBeInTheDocument();
  });
});
