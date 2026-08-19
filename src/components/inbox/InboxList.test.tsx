import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxList } from "./InboxList";
import type { InboxData } from "../../stores/dataStore";

const empty: InboxData = { reviewRequests: [], ciFailures: [], mentions: [] };

describe("InboxList", () => {
  it("shows empty state when all sections are empty", () => {
    render(<InboxList data={empty} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Inbox zero")).toBeInTheDocument();
  });

  it("renders Review Requests section with items", () => {
    const data = {
      ...empty,
      reviewRequests: [
        {
          id: "1",
          kind: "review_requested",
          repo: "o/r",
          number: null,
          title: "Review me",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
    };
    render(<InboxList data={data} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Review Requests")).toBeInTheDocument();
    expect(screen.getByText("Review me")).toBeInTheDocument();
  });

  it("renders CI Failures section", () => {
    const data = {
      ...empty,
      ciFailures: [
        {
          id: "ci-1",
          kind: "ci_failure",
          repo: "o/r",
          number: 5,
          title: "Build failed",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
    };
    render(<InboxList data={data} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("CI Failures")).toBeInTheDocument();
    expect(screen.getByText("Build failed")).toBeInTheDocument();
  });

  it("renders Mentions section", () => {
    const data = {
      ...empty,
      mentions: [
        {
          id: "m1",
          kind: "mention",
          repo: "o/r",
          number: null,
          title: "You were mentioned",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
    };
    render(<InboxList data={data} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Mentions")).toBeInTheDocument();
  });

  it("hides empty sections", () => {
    const data = {
      ...empty,
      reviewRequests: [
        {
          id: "1",
          kind: "review_requested",
          repo: "o/r",
          number: null,
          title: "Review",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
    };
    render(<InboxList data={data} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByText("CI Failures")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentions")).not.toBeInTheDocument();
  });

  it("passes pin and snooze actions into the Stale section", () => {
    const stale = {
      id: "stale-1",
      kind: "stale_review_request" as const,
      repo: "o/r",
      number: 2,
      title: "Stale review",
      htmlUrl: null,
      updatedAt: "2026-04-01T00:00:00Z",
      unread: true,
      pinned: false,
    };
    render(
      <InboxList
        data={empty}
        staleItems={[stale]}
        selectedId="stale-1"
        onSelect={() => {}}
        onTogglePin={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByLabelText("Pin")).toBeInTheDocument();
    expect(screen.getByLabelText("Snooze until Tomorrow")).toBeInTheDocument();
  });
});
