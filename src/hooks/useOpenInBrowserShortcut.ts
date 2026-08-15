import { useKeyboardShortcut } from "./useKeyboardShortcut";
import { openInBrowser } from "../lib/openInBrowser";
import { useUiStore } from "../stores/uiStore";

/** O opens the current item in the system browser. */
export function useOpenInBrowserShortcut(url: string | null | undefined): void {
  useKeyboardShortcut({ key: "o", preventDefault: true }, () => {
    if (useUiStore.getState().commandPaletteOpen) return;
    void openInBrowser(url);
  });
}
