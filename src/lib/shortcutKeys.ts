import type { ShortcutId, ShortcutSetting } from "../stores/settingsStore";

export interface ParsedShortcut {
  key: string;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  /** Chord sequences like "G then I" are not single keydown matches. */
  chord: boolean;
  raw: string;
}

/**
 * Parse display strings such as `Cmd+K`, `Ctrl+Shift+X`, `]`, `G then I`.
 * Meta treats Cmd/Ctrl interchangeably at match time.
 */
export function parseShortcutKeys(raw: string): ParsedShortcut {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { key: "", meta: false, shift: false, alt: false, chord: false, raw: trimmed };
  }
  if (/\bthen\b/i.test(trimmed) || trimmed.includes("/")) {
    // Chords / multi-option labels are display-only for now
    return { key: "", meta: false, shift: false, alt: false, chord: true, raw: trimmed };
  }
  const parts = trimmed.split("+").map((p) => p.trim()).filter(Boolean);
  let meta = false;
  let shift = false;
  let alt = false;
  let key = "";
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "cmd" || lower === "meta" || lower === "ctrl" || lower === "control") {
      meta = true;
    } else if (lower === "shift") {
      shift = true;
    } else if (lower === "alt" || lower === "option") {
      alt = true;
    } else {
      key = part.length === 1 ? part.toLowerCase() : part;
    }
  }
  // Prefer lowercase for letter keys
  if (key.length === 1) key = key.toLowerCase();
  const aliases: Record<string, string> = {
    esc: "Escape",
    escape: "Escape",
    return: "Enter",
    enter: "Enter",
    space: " ",
    spacebar: " ",
  };
  const alias = aliases[key.toLowerCase()];
  if (alias) key = alias;
  return { key, meta, shift, alt, chord: false, raw: trimmed };
}

export function formatShortcutEvent(event: KeyboardEvent): string | null {
  const key = event.key;
  if (!key || key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
    return null;
  }
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Cmd");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey && key.length !== 1) parts.push("Shift");
  else if (event.shiftKey && key.length === 1 && key === key.toUpperCase() && /[a-z]/i.test(key)) {
    // Letter with shift → Shift+Letter
    parts.push("Shift");
  } else if (event.shiftKey && key.length === 1) {
    parts.push("Shift");
  }
  let displayKey = key.length === 1 ? key.toUpperCase() : key;
  if (displayKey === " ") displayKey = "Space";
  if (displayKey === "?") {
    // shift+/ often produces ?
    return parts.includes("Shift") || event.shiftKey ? "?" : "?";
  }
  parts.push(displayKey);
  // Normalize Shift+? → just ? for help binding
  if (displayKey === "?" && parts.includes("Shift")) {
    return "?";
  }
  return parts.join("+");
}

export function normalizeShortcutKeyString(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface ShortcutConflict {
  id: ShortcutId;
  otherId: ShortcutId;
  keys: string;
}

/** Detect duplicate bindings among single-key (non-chord) shortcuts. */
export function findShortcutConflicts(
  shortcuts: Record<ShortcutId, ShortcutSetting>,
): ShortcutConflict[] {
  const byKey = new Map<string, ShortcutId[]>();
  for (const [id, setting] of Object.entries(shortcuts) as [ShortcutId, ShortcutSetting][]) {
    const parsed = parseShortcutKeys(setting.keys);
    if (parsed.chord || !parsed.key) continue;
    const token = [
      parsed.meta ? "m" : "",
      parsed.alt ? "a" : "",
      parsed.shift ? "s" : "",
      parsed.key.toLowerCase(),
    ].join(":");
    const list = byKey.get(token) ?? [];
    list.push(id);
    byKey.set(token, list);
  }
  const conflicts: ShortcutConflict[] = [];
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        conflicts.push({
          id: ids[i],
          otherId: ids[j],
          keys: shortcuts[ids[i]].keys,
        });
      }
    }
  }
  return conflicts;
}

export function eventMatchesShortcut(event: KeyboardEvent, raw: string): boolean {
  const parsed = parseShortcutKeys(raw);
  if (parsed.chord || !parsed.key) return false;
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const wantKey = parsed.key.length === 1 ? parsed.key.toLowerCase() : parsed.key;

  let keyOk = eventKey === wantKey || event.key === parsed.key;
  if (!keyOk && parsed.key === "?") {
    keyOk = event.key === "?" || (event.key === "/" && event.shiftKey);
  }
  if (!keyOk) return false;

  const isMeta = event.metaKey || event.ctrlKey;
  if (parsed.meta !== isMeta) return false;
  if (parsed.alt !== event.altKey) return false;
  // "?" is typically produced with Shift; ignore shift mismatch for it
  if (parsed.key === "?") return true;
  if (parsed.shift !== event.shiftKey) return false;
  return true;
}
