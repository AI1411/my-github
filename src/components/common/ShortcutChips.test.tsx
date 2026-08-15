import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "../../stores/settingsStore";
import { ShortcutChips } from "./ShortcutChips";

describe("ShortcutChips", () => {
  beforeEach(() => {
    useSettingsStore.setState({ shortcutChipsEnabled: true });
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
});
