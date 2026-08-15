import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../stores/uiStore";
import { useOpenInBrowserShortcut } from "./useOpenInBrowserShortcut";

const openInBrowser = vi.fn();

vi.mock("../lib/openInBrowser", () => ({
  openInBrowser: (...args: unknown[]) => openInBrowser(...args),
}));

function Probe({ url }: { url: string | null }) {
  useOpenInBrowserShortcut(url);
  return null;
}

describe("useOpenInBrowserShortcut", () => {
  beforeEach(() => {
    openInBrowser.mockReset();
    useUiStore.setState({ commandPaletteOpen: false });
  });

  it("opens the URL with O", () => {
    render(<Probe url="https://github.com/o/r/pull/1" />);
    fireEvent.keyDown(window, { key: "o" });
    expect(openInBrowser).toHaveBeenCalledWith("https://github.com/o/r/pull/1");
  });

  it("does not open when the command palette is open", () => {
    useUiStore.setState({ commandPaletteOpen: true });
    render(<Probe url="https://github.com/o/r/pull/1" />);
    fireEvent.keyDown(window, { key: "o" });
    expect(openInBrowser).not.toHaveBeenCalled();
  });
});
