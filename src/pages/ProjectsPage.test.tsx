import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectsPage from "./ProjectsPage";

describe("ProjectsPage", () => {
  it("shows coming-soon empty state", () => {
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Projects browsing coming soon")).toBeInTheDocument();
  });
});
