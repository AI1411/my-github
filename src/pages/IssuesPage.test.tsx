import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import IssuesPage from "./IssuesPage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("IssuesPage", () => {
  it("renders the three-column grid sections", () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("issues-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("issues-filters")).toBeInTheDocument();
    expect(screen.getByTestId("issues-list")).toBeInTheDocument();
  });

  it("uses CSS grid layout on the root", () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>,
    );
    const root = screen.getByTestId("issues-page-root");
    expect(root).toHaveStyle({ display: "grid" });
  });
});
