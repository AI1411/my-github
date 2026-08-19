import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../../stores/settingsStore";
import { GlobalShortcuts } from "./GlobalShortcuts";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("GlobalShortcuts", () => {
  beforeEach(() => {
    navigate.mockReset();
    useSettingsStore.setState({ shortcuts: DEFAULT_SHORTCUTS });
  });

  it("navigates to Inbox on G then I", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "i" });
    expect(navigate).toHaveBeenCalledWith("/inbox");
  });

  it("navigates to Pulls on G then P", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });
    expect(navigate).toHaveBeenCalledWith("/pulls");
  });

  it("navigates to Settings on G then S", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "s" });
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("navigates to Activity on G then A", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "a" });
    expect(navigate).toHaveBeenCalledWith("/activity");
  });

  it("navigates to CI Status on G then C", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "c" });
    expect(navigate).toHaveBeenCalledWith("/ci");
  });

  it("navigates to Review queue on G then R", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "r" });
    expect(navigate).toHaveBeenCalledWith("/review-queue");
  });

  it("navigates to My blockers on G then B", () => {
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "b" });
    expect(navigate).toHaveBeenCalledWith("/my-blockers");
  });

  it("syncs on Cmd+R", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    render(<GlobalShortcuts />);
    fireEvent.keyDown(window, { key: "r", metaKey: true });
    expect(invoke).toHaveBeenCalledWith("cmd_sync_now");
  });
});
