import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../stores/settingsStore";
import { useSettingsShortcut } from "./useSettingsShortcut";

describe("useSettingsShortcut chords", () => {
  beforeEach(() => {
    useSettingsStore.setState({ shortcuts: DEFAULT_SHORTCUTS });
  });

  it("fires goInbox after G then I", () => {
    const handler = vi.fn();
    renderHook(() => useSettingsShortcut("goInbox", handler));
    fireEvent.keyDown(window, { key: "g" });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "i" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores the sequence inside an input", () => {
    const handler = vi.fn();
    renderHook(() => useSettingsShortcut("goInbox", handler));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "i" });
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });
});
