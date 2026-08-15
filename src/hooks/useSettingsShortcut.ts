import { useEffect, useRef } from "react";
import {
  applyChordKeydown,
  eventMatchesShortcut,
  parseShortcutKeys,
  type ChordArmState,
} from "../lib/shortcutKeys";
import { useSettingsStore, type ShortcutId } from "../stores/settingsStore";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Bind a handler to a settings-store shortcut id (customizable in Settings).
 * Chord strings such as `G then I` arm on the first key and fire on the second.
 */
export function useSettingsShortcut(
  id: ShortcutId,
  handler: (event: KeyboardEvent) => void,
  options: { allowInInputs?: boolean; preventDefault?: boolean } = {},
): void {
  const keys = useSettingsStore((s) => s.shortcuts[id]?.keys ?? "");
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const chordRef = useRef<ChordArmState>({ prefix: null, armedAt: 0 });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!options.allowInInputs && isEditable(event.target)) return;
      const parsed = parseShortcutKeys(keys);
      if (parsed.chord) {
        const { matched, next } = applyChordKeydown(chordRef.current, event, parsed);
        chordRef.current = next;
        if (!matched) return;
      } else if (!eventMatchesShortcut(event, keys)) {
        return;
      }
      if (options.preventDefault !== false) event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, options.allowInInputs, options.preventDefault]);
}
