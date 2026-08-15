import { useEffect, useRef } from "react";
import { eventMatchesShortcut } from "../lib/shortcutKeys";
import { useSettingsStore, type ShortcutId } from "../stores/settingsStore";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Bind a handler to a settings-store shortcut id (customizable in Settings).
 */
export function useSettingsShortcut(
  id: ShortcutId,
  handler: (event: KeyboardEvent) => void,
  options: { allowInInputs?: boolean; preventDefault?: boolean } = {},
): void {
  const keys = useSettingsStore((s) => s.shortcuts[id]?.keys ?? "");
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!options.allowInInputs && isEditable(event.target)) return;
      if (!eventMatchesShortcut(event, keys)) return;
      if (options.preventDefault !== false) event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, options.allowInInputs, options.preventDefault]);
}
