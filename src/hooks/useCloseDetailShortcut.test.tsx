import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";
import { useCloseDetailShortcut } from "./useCloseDetailShortcut";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe("useCloseDetailShortcut", () => {
  beforeEach(() => {
    navigate.mockReset();
    useSettingsStore.setState({ shortcuts: DEFAULT_SHORTCUTS });
    useUiStore.setState({ commandPaletteOpen: false, workspaceSwitcherOpen: false });
  });

  it("navigates back on Escape", () => {
    renderHook(() => useCloseDetailShortcut());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("does not navigate when the command palette is open", () => {
    useUiStore.setState({ commandPaletteOpen: true });
    renderHook(() => useCloseDetailShortcut());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(navigate).not.toHaveBeenCalled();
  });
});
