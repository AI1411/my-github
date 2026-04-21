import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { useUiStore } from "../../stores/uiStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    useUiStore.setState({ commandPaletteOpen: true });
  });

  it("renders search input when open", () => {
    renderPalette();
    expect(screen.getByPlaceholderText("Search or jump to…")).toBeInTheDocument();
  });

  it("shows nav commands by default (empty query)", () => {
    renderPalette();
    expect(screen.getByText("Go to Inbox")).toBeInTheDocument();
    expect(screen.getByText("Go to Pull Requests")).toBeInTheDocument();
    expect(screen.getByText("Go to Issues")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    useUiStore.setState({ commandPaletteOpen: false });
    renderPalette();
    expect(screen.queryByPlaceholderText("Search or jump to…")).not.toBeInTheDocument();
  });

  it("closes on Esc key", () => {
    renderPalette();
    const input = screen.getByPlaceholderText("Search or jump to…");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("navigates selection down with ArrowDown", () => {
    renderPalette();
    const input = screen.getByPlaceholderText("Search or jump to…");
    const firstItem = screen.getAllByRole("option")[0];
    expect(firstItem).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
  });

  it("closes backdrop click", () => {
    renderPalette();
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
