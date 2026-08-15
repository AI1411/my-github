import { useNavigate } from "react-router-dom";
import { useSettingsShortcut } from "./useSettingsShortcut";
import { useUiStore } from "../stores/uiStore";

function blockingOverlayOpen(): boolean {
  const ui = useUiStore.getState();
  if (ui.commandPaletteOpen || ui.workspaceSwitcherOpen) return true;
  return Boolean(document.querySelector('[role="dialog"][aria-label="Shortcut help"]'));
}

/** Esc on PR/Issue detail goes back, unless a modal owns the key. */
export function useCloseDetailShortcut(): void {
  const navigate = useNavigate();

  useSettingsShortcut("closeDetail", () => {
    if (blockingOverlayOpen()) return;
    navigate(-1);
  });
}
