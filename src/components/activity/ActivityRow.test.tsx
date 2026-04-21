import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityRow } from "./ActivityRow";
import type { NotificationSummary } from "../../stores/dataStore";

const notification: NotificationSummary = {
  id: "1",
  reason: "review_requested",
  repo: "octocat/hello",
  subjectTitle: "Fix critical bug",
  subjectType: "PullRequest",
  htmlUrl: "https://github.com/octocat/hello/pull/5",
  unread: true,
  updatedAt: "2026-04-21T00:00:00Z",
};

describe("ActivityRow", () => {
  it("renders the subject title", () => {
    render(<ActivityRow notification={notification} />);
    expect(screen.getByText("Fix critical bug")).toBeInTheDocument();
  });

  it("renders the repo", () => {
    render(<ActivityRow notification={notification} />);
    expect(screen.getByText(/octocat\/hello/)).toBeInTheDocument();
  });

  it("renders an icon with aria-label matching reason", () => {
    render(<ActivityRow notification={notification} />);
    const icon = screen.getByTestId("activity-icon");
    expect(icon).toHaveAttribute("aria-label", "review_requested");
  });

  it("shows unread dot when unread=true", () => {
    render(<ActivityRow notification={notification} />);
    expect(screen.getByTestId("unread-dot")).toBeInTheDocument();
  });

  it("hides unread dot when unread=false", () => {
    render(<ActivityRow notification={{ ...notification, unread: false }} />);
    expect(screen.queryByTestId("unread-dot")).not.toBeInTheDocument();
  });
});
