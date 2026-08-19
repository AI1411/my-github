import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PullsPage from "./PullsPage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("PullsPage", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 800,
    });
  });

  it("renders pull request tabs", async () => {
    render(
      <MemoryRouter>
        <PullsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("tab", { name: /created/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /assigned/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /review/i })).toBeInTheDocument();
  });

  it("renders the page toolbar title", async () => {
    render(
      <MemoryRouter>
        <PullsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Pull Requests")).toBeInTheDocument();
  });
});
