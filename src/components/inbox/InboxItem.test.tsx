import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxItemRow } from "./InboxItem";
import type { InboxItem } from "../../stores/dataStore";

const item: InboxItem = {
  id: "1", kind: "review_requested", repo: "octocat/hello", number: 5,
  title: "Fix critical bug", htmlUrl: "https://github.com/octocat/hello/pull/5",
  updatedAt: "2026-04-21T00:00:00Z", unread: true,
};

describe("InboxItemRow", () => {
  it("renders the title", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByText("Fix critical bug")).toBeInTheDocument();
  });

  it("renders repo and number", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByText(/octocat\/hello/)).toBeInTheDocument();
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it("shows Unread indicator when unread=true", () => {
    render(<InboxItemRow item={item} />);
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  });

  it("hides Unread indicator when unread=false", () => {
    render(<InboxItemRow item={{ ...item, unread: false }} />);
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });
});
