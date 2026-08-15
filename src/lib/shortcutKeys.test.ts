import { describe, expect, it } from "vitest";
import {
  applyChordKeydown,
  eventMatchesShortcut,
  findShortcutConflicts,
  formatShortcutEvent,
  parseShortcutKeys,
} from "./shortcutKeys";
import { DEFAULT_SHORTCUTS, type ShortcutId, type ShortcutSetting } from "../stores/settingsStore";

describe("parseShortcutKeys", () => {
  it("parses Cmd+K", () => {
    expect(parseShortcutKeys("Cmd+K")).toEqual({
      key: "k",
      meta: true,
      shift: false,
      alt: false,
      chord: false,
      chordPrefix: null,
      raw: "Cmd+K",
    });
  });

  it("parses G then I into a chord prefix and second key", () => {
    expect(parseShortcutKeys("G then I")).toEqual({
      key: "i",
      meta: false,
      shift: false,
      alt: false,
      chord: true,
      chordPrefix: "g",
      raw: "G then I",
    });
  });

  it("marks chords", () => {
    expect(parseShortcutKeys("G then I").chord).toBe(true);
  });
});

describe("findShortcutConflicts", () => {
  it("finds duplicate bindings", () => {
    const shortcuts = {
      ...DEFAULT_SHORTCUTS,
      listUp: { ...DEFAULT_SHORTCUTS.listUp, keys: "J" },
    } as Record<ShortcutId, ShortcutSetting>;
    const conflicts = findShortcutConflicts(shortcuts);
    expect(conflicts.some((c) => c.keys === "J")).toBe(true);
  });

  it("returns empty for defaults", () => {
    expect(findShortcutConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
  });
});

describe("eventMatchesShortcut", () => {
  it("does not match a chord on a single keydown", () => {
    const event = new KeyboardEvent("keydown", { key: "i" });
    expect(eventMatchesShortcut(event, "G then I")).toBe(false);
  });
});

describe("formatShortcutEvent", () => {
  it("formats modifier chords", () => {
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    expect(formatShortcutEvent(event)).toBe("Cmd+K");
  });
});

describe("applyChordKeydown", () => {
  const parsed = parseShortcutKeys("G then I");

  it("matches G then I", () => {
    const g = new KeyboardEvent("keydown", { key: "g" });
    const armed = applyChordKeydown({ prefix: null, armedAt: 0 }, g, parsed, 1_000);
    expect(armed.matched).toBe(false);
    expect(armed.next.prefix).toBe("g");

    const i = new KeyboardEvent("keydown", { key: "i" });
    const hit = applyChordKeydown(armed.next, i, parsed, 1_100);
    expect(hit.matched).toBe(true);
  });

  it("expires the prefix after the timeout", () => {
    const g = new KeyboardEvent("keydown", { key: "g" });
    const armed = applyChordKeydown({ prefix: null, armedAt: 0 }, g, parsed, 1_000);
    const i = new KeyboardEvent("keydown", { key: "i" });
    const late = applyChordKeydown(armed.next, i, parsed, 1_000 + 801);
    expect(late.matched).toBe(false);
  });
});
