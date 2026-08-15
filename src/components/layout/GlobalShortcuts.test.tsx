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
});
