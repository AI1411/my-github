import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "./Tabs";

describe("Tabs a11y", () => {
  it("sets aria-controls and roving tabindex", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ]}
        activeId="a"
        onChange={() => {}}
        panelIdPrefix="test"
      />,
    );
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    const beta = screen.getByRole("tab", { name: "Beta" });
    expect(alpha).toHaveAttribute("aria-controls", "test-panel-a");
    expect(beta).toHaveAttribute("aria-controls", "test-panel-b");
    expect(alpha).toHaveAttribute("tabindex", "0");
    expect(beta).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection with arrow keys", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ]}
        activeId="a"
        onChange={onChange}
      />,
    );
    const tablist = screen.getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
