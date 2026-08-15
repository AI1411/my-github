import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    // jsdom reports 0 height; virtualizer needs a viewport to mount rows.
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 800,
    });
  });

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

  it("wires the FilterSidebar to uiStore.issueFilters", async () => {
    const { useUiStore } = await import("../stores/uiStore");
    useUiStore.setState({ issueFilters: { labels: [], state: "closed" } });
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>,
    );
    // The "Closed" State row should be active (button color/bg)
    const closedRow = screen.getByRole("button", { name: "Closed" });
    expect(closedRow.style.backgroundColor).not.toBe("transparent");
  });

  it("renders applied filter chips when state is set", async () => {
    const { useUiStore } = await import("../stores/uiStore");
    useUiStore.setState({ issueFilters: { labels: [], state: "open" } });
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("State: open")).toBeInTheDocument();
  });

  it("renders one IssueRow per fetched issue", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        number: 1,
        title: "first",
        repo: "o/r",
        author: "a",
        state: "open",
        labels: [],
        assignees: [],
        milestone: null,
        comments: 0,
        updatedAt: new Date().toISOString(),
        htmlUrl: null,
        body: null,
      },
      {
        id: 2,
        number: 2,
        title: "second",
        repo: "o/r",
        author: "a",
        state: "open",
        labels: [],
        assignees: [],
        milestone: null,
        comments: 0,
        updatedAt: new Date().toISOString(),
        htmlUrl: null,
        body: null,
      },
    ]);
    const { useUiStore } = await import("../stores/uiStore");
    useUiStore.setState({ issueFilters: { labels: [] } });
    const { findByText } = render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>,
    );
    expect(await findByText("first")).toBeInTheDocument();
    expect(await findByText("second")).toBeInTheDocument();
  });
});
