import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactionPills, type ReactionInfo } from "./ReactionPills";

const base: ReactionInfo[] = [
  { content: "+1", count: 2, viewerHasReacted: false },
  { content: "-1", count: 0, viewerHasReacted: false },
  { content: "laugh", count: 0, viewerHasReacted: false },
  { content: "hooray", count: 0, viewerHasReacted: false },
  { content: "confused", count: 0, viewerHasReacted: false },
  { content: "heart", count: 1, viewerHasReacted: true },
  { content: "rocket", count: 0, viewerHasReacted: false },
  { content: "eyes", count: 0, viewerHasReacted: false },
];

describe("ReactionPills", () => {
  it("invokes onToggle with reaction content when a pill is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ReactionPills reactions={base} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: /\+1 reaction/i }));
    expect(onToggle).toHaveBeenCalledWith("+1");

    await user.click(screen.getByRole("button", { name: /heart reaction/i }));
    expect(onToggle).toHaveBeenCalledWith("heart");
  });

  it("marks viewer-reacted pills as pressed", () => {
    render(<ReactionPills reactions={base} onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: /heart reaction/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
