import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DiscussionsPage from "./DiscussionsPage";

describe("DiscussionsPage", () => {
  it("shows coming-soon empty state", () => {
    render(
      <MemoryRouter>
        <DiscussionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Discussions browsing coming soon")).toBeInTheDocument();
  });
});
