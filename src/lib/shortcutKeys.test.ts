import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyChordKeydown,
  displayShortcutKeys,
  eventMatchesShortcut,
  findShortcutConflicts,
  formatShortcutEvent,
  isApplePlatform,
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

describe("isApplePlatform", () => {
  let platformSpy: ReturnType<typeof vi.spyOn> | undefined;
  let userAgentSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    platformSpy?.mockRestore();
    userAgentSpy?.mockRestore();
  });

  function mockNavigator(platform: string, userAgent = "") {
    platformSpy = vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
    userAgentSpy = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  }

  it("detects macOS", () => {
    mockNavigator("MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(isApplePlatform()).toBe(true);
  });

  it("detects iOS", () => {
    mockNavigator("iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isApplePlatform()).toBe(true);
  });

  it("returns false on Windows", () => {
    mockNavigator("Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(isApplePlatform()).toBe(false);
  });

  it("returns false on Linux", () => {
    mockNavigator("Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64)");
    expect(isApplePlatform()).toBe(false);
  });
});

describe("displayShortcutKeys", () => {
  let platformSpy: ReturnType<typeof vi.spyOn> | undefined;
  let userAgentSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    platformSpy?.mockRestore();
    userAgentSpy?.mockRestore();
  });

  function mockNavigator(platform: string, userAgent = "") {
    platformSpy = vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
    userAgentSpy = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  }

  it("keeps Cmd on Apple platforms", () => {
    mockNavigator("MacIntel");
    expect(displayShortcutKeys("Cmd+K")).toBe("Cmd+K");
    expect(displayShortcutKeys("Cmd+Shift+P")).toBe("Cmd+Shift+P");
  });

  it("replaces Cmd with Ctrl on non-Apple platforms", () => {
    mockNavigator("Win32");
    expect(displayShortcutKeys("Cmd+K")).toBe("Ctrl+K");
    expect(displayShortcutKeys("Cmd+Shift+P")).toBe("Ctrl+Shift+P");
  });

  it("leaves shortcuts without Cmd unchanged", () => {
    mockNavigator("Linux x86_64");
    expect(displayShortcutKeys("G then I")).toBe("G then I");
    expect(displayShortcutKeys("J")).toBe("J");
    expect(displayShortcutKeys("?")).toBe("?");
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
