import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InboxDetailPanel } from "./InboxDetailPanel";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("InboxDetailPanel", () => {
  it("shows placeholder when item is null", () => {
    render(<InboxDetailPanel item={null} />);
    expect(screen.getByText("Select an item to preview")).toBeInTheDocument();
  });

  it("renders item title and repo", () => {
    render(
      <InboxDetailPanel
        item={{
          id: "1",
          kind: "review_requested",
          repo: "octocat/hello",
          number: 5,
          title: "Fix bug",
          htmlUrl: "https://github.com/octocat/hello/pull/5",
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        }}
      />,
    );
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText(/octocat\/hello/)).toBeInTheDocument();
  });

  it("shows Open in Browser button when htmlUrl is present", () => {
    render(
      <InboxDetailPanel
        item={{
          id: "1",
          kind: "mention",
          repo: "o/r",
          number: null,
          title: "Mention",
          htmlUrl: "https://github.com/o/r/issues/1",
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        }}
      />,
    );
    expect(screen.getByText("Open in Browser")).toBeInTheDocument();
  });

  it("opens in-app detail from the preview Open button", () => {
    const onOpenInApp = vi.fn();
    render(
      <InboxDetailPanel
        item={{
          id: "1",
          kind: "review_requested",
          repo: "octocat/hello",
          number: 5,
          title: "Fix bug",
          htmlUrl: "https://github.com/octocat/hello/pull/5",
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        }}
        onOpenInApp={onOpenInApp}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenInApp).toHaveBeenCalledTimes(1);
  });
});
