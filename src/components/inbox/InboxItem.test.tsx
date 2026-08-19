import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InboxItemRow } from "./InboxItem";
import type { InboxItem } from "../../stores/dataStore";

const item: InboxItem = {
  id: "1",
  kind: "review_requested",
  repo: "octocat/hello",
  number: 5,
  title: "Fix critical bug",
  htmlUrl: "https://github.com/octocat/hello/pull/5",
  updatedAt: "2026-04-21T00:00:00Z",
  unread: true,
  pinned: false,
};

describe("InboxItemRow", () => {
  it("renders the title", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByText("Fix critical bug")).toBeInTheDocument();
  });

  it("uses density-aware vertical padding", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByRole("row")).toHaveStyle({ paddingBlock: "var(--row-pad-y)" });
  });

  it("renders repo and number", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByText(/octocat\/hello/)).toBeInTheDocument();
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it("shows why the item is in Inbox", () => {
    const { rerender } = render(<InboxItemRow item={item} />);
    expect(screen.getByText(/Review requested/)).toBeInTheDocument();
    rerender(<InboxItemRow item={{ ...item, kind: "ci_failure" }} />);
    expect(screen.getByText(/CI failing/)).toBeInTheDocument();
    rerender(<InboxItemRow item={{ ...item, kind: "mention" }} />);
    expect(screen.getByText(/Mentioned/)).toBeInTheDocument();
    rerender(<InboxItemRow item={{ ...item, kind: "stale_review_request" }} />);
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
  });

  it("shows Unread indicator when unread=true", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  });

  it("hides Unread indicator when unread=false", () => {
    render(<InboxItemRow item={{ ...item, unread: false }} />);
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });

  it("shows Pinned indicator when pinned=true", () => {
    render(<InboxItemRow item={{ ...item, pinned: true }} />);
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("hides actions when no handlers are given", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.queryByLabelText("Pin")).not.toBeInTheDocument();
  });

  it("calls onTogglePin without triggering onSelect", () => {
    const onTogglePin = vi.fn();
    const onSelect = vi.fn();
    render(<InboxItemRow item={item} onSelect={onSelect} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByLabelText("Pin"));
    expect(onTogglePin).toHaveBeenCalledWith(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("labels the pin button Unpin when already pinned", () => {
    render(<InboxItemRow item={{ ...item, pinned: true }} onTogglePin={vi.fn()} />);
    expect(screen.getByLabelText("Unpin")).toBeInTheDocument();
  });

  it("calls onSnooze with the chosen option", () => {
    const onSnooze = vi.fn();
    render(<InboxItemRow item={item} onSnooze={onSnooze} />);
    fireEvent.click(screen.getByLabelText("Snooze until Tomorrow"));
    expect(onSnooze).toHaveBeenCalledWith(item, "tomorrow");
  });

  it("keeps pin and snooze visible on the selected row", () => {
    const { rerender } = render(
      <InboxItemRow item={item} onTogglePin={vi.fn()} onSnooze={vi.fn()} />,
    );
    const actions = screen.getByTestId("inbox-row-actions");
    expect(actions).toHaveClass("opacity-0");
    rerender(<InboxItemRow item={item} selected onTogglePin={vi.fn()} onSnooze={vi.fn()} />);
    expect(screen.getByTestId("inbox-row-actions")).toHaveClass("opacity-100");
    expect(screen.getByLabelText("Pin")).toBeVisible();
  });
});
