import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppliedFilters } from "./AppliedFilters";

describe("AppliedFilters", () => {
  it("renders nothing when filter is empty", () => {
    const { container } = render(
      <AppliedFilters filter={{ labels: [] }} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a chip per applied filter", () => {
    render(
      <AppliedFilters
        filter={{
          labels: ["bug", "p0"],
          state: "open",
          repoFullName: "o/r",
          assigneeLogin: "alice",
          milestoneTitle: "v1",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/State: open/)).toBeInTheDocument();
    expect(screen.getByText("Label: bug")).toBeInTheDocument();
    expect(screen.getByText("Label: p0")).toBeInTheDocument();
    expect(screen.getByText("Repo: o/r")).toBeInTheDocument();
    expect(screen.getByText("Assignee: alice")).toBeInTheDocument();
    expect(screen.getByText("Milestone: v1")).toBeInTheDocument();
  });

  it("clears a label when its × is clicked", async () => {
    const onChange = vi.fn();
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <AppliedFilters
        filter={{ labels: ["bug"] }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear Label: bug" }));
    expect(onChange).toHaveBeenCalledWith({ labels: [] });
  });

  it("clears state when its × is clicked", async () => {
    const onChange = vi.fn();
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <AppliedFilters
        filter={{ labels: [], state: "open" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Clear State/ }));
    expect(onChange).toHaveBeenCalledWith({ labels: [] });
  });
});
