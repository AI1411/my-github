import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../../stores/settingsStore";
import { ShortcutChips } from "./ShortcutChips";

describe("ShortcutChips", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      shortcutChipsEnabled: true,
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("shows inbox context shortcuts", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <ShortcutChips />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Context shortcuts")).toHaveTextContent("Snooze");
    expect(screen.getByLabelText("Context shortcuts")).toHaveTextContent("Mark read");
  });

  it("hides when disabled in settings", () => {
    useSettingsStore.setState({ shortcutChipsEnabled: false });
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <ShortcutChips />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("Context shortcuts")).not.toBeInTheDocument();
  });

  it("opens shortcut help on ? and closes on Escape", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <ShortcutChips />
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Shortcut help" })).toBeInTheDocument();
    expect(screen.getByText("Go to Inbox")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Shortcut help" })).not.toBeInTheDocument();
  });
});
