import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterSidebar } from "./FilterSidebar";

describe("FilterSidebar", () => {
  it("renders all required sections", () => {
    render(
      <FilterSidebar
        filter={{ labels: [] }}
        onChange={vi.fn()}
        availableLabels={[]}
        availableAssignees={[]}
        availableRepos={[]}
        availableMilestones={[]}
      />,
    );
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("Milestone")).toBeInTheDocument();
  });

  it("renders a checkbox per label with color swatch and count", () => {
    render(
      <FilterSidebar
        filter={{ labels: ["bug"] }}
        onChange={vi.fn()}
        availableLabels={[
          { name: "bug", color: "d73a4a", count: 5 },
          { name: "docs", color: "0075ca", count: 2 },
        ]}
        availableAssignees={[]}
        availableRepos={[]}
        availableMilestones={[]}
      />,
    );
    const bugBox = screen.getByRole("checkbox", { name: /bug/ });
    const docsBox = screen.getByRole("checkbox", { name: /docs/ });
    expect(bugBox).toBeChecked();
    expect(docsBox).not.toBeChecked();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("invokes onChange with toggled labels when a checkbox is clicked", async () => {
    const onChange = vi.fn();
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <FilterSidebar
        filter={{ labels: [] }}
        onChange={onChange}
        availableLabels={[{ name: "bug", color: "d73a4a", count: 1 }]}
        availableAssignees={[]}
        availableRepos={[]}
        availableMilestones={[]}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: /bug/ }));
    expect(onChange).toHaveBeenCalledWith({ labels: ["bug"] });
  });
});
