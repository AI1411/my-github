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
});
