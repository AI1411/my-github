import { describe, expect, it } from "vitest";
import {
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
      raw: "Cmd+K",
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
  it("matches meta shortcuts", () => {
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    expect(eventMatchesShortcut(event, "Cmd+K")).toBe(true);
    expect(eventMatchesShortcut(event, "J")).toBe(false);
  });
});

describe("formatShortcutEvent", () => {
  it("formats modifier chords", () => {
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    expect(formatShortcutEvent(event)).toBe("Cmd+K");
  });
});
