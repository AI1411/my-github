import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrossAccountInboxList } from "./CrossAccountInboxList";
import type { CrossAccountInboxItem } from "../../stores/dataStore";

const aliceItem: CrossAccountInboxItem = {
  id: "pr-1",
  kind: "review_requested",
  repo: "octocat/hello",
  number: 5,
  title: "Needs review",
  htmlUrl: "https://github.com/octocat/hello/pull/5",
  updatedAt: "2026-04-21T00:00:00Z",
  unread: true,
  pinned: false,
  accountLogin: "alice",
  accountAvatarUrl: null,
  isActiveAccount: true,
};

const bobItem: CrossAccountInboxItem = {
  id: "ci-b/r-2",
  kind: "ci_failure",
  repo: "b/r",
  number: 2,
  title: "Build broken",
  htmlUrl: "https://github.com/b/r/pull/2",
  updatedAt: "2026-04-22T00:00:00Z",
  unread: true,
  pinned: false,
  accountLogin: "bob",
  accountAvatarUrl: null,
  isActiveAccount: false,
};

describe("CrossAccountInboxList", () => {
  it("renders an empty state when there are no items", () => {
    render(<CrossAccountInboxList items={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Inbox zero across accounts")).toBeInTheDocument();
  });

  it("renders each item with its owning account badge", () => {
    render(
      <CrossAccountInboxList items={[aliceItem, bobItem]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Build broken")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("invokes onSelect with the clicked item", () => {
    const onSelect = vi.fn();
    render(
      <CrossAccountInboxList items={[aliceItem, bobItem]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("Build broken"));
    expect(onSelect).toHaveBeenCalledWith(bobItem);
  });
});
