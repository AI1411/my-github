import { describe, expect, it } from "vitest";
import { loadLastSnoozeOption, saveLastSnoozeOption, snoozeUntilEpochSecs } from "./snooze";

describe("snoozeUntilEpochSecs", () => {
  const now = new Date("2026-07-16T15:30:00");

  it("1h adds exactly one hour", () => {
    const until = snoozeUntilEpochSecs("1h", now);
    expect(until).toBe(Math.floor(now.getTime() / 1000) + 3600);
  });

  it("tomorrow resolves to 9:00 local on the next day", () => {
    const until = snoozeUntilEpochSecs("tomorrow", now);
    const resolved = new Date(until * 1000);
    expect(resolved.getDate()).toBe(17);
    expect(resolved.getHours()).toBe(9);
    expect(resolved.getMinutes()).toBe(0);
  });

  it("nextWeek resolves to 9:00 local seven days later", () => {
    const until = snoozeUntilEpochSecs("nextWeek", now);
    const resolved = new Date(until * 1000);
    expect(resolved.getDate()).toBe(23);
    expect(resolved.getHours()).toBe(9);
  });

  it("tomorrow crosses month boundaries", () => {
    const endOfMonth = new Date("2026-07-31T10:00:00");
    const until = snoozeUntilEpochSecs("tomorrow", endOfMonth);
    const resolved = new Date(until * 1000);
    expect(resolved.getMonth()).toBe(7); // August (0-indexed)
    expect(resolved.getDate()).toBe(1);
  });
});

describe("last snooze option persistence", () => {
  function memoryStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map(Object.entries(initial));
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key: string) => map.get(key) ?? null,
      key: (index: number) => [...map.keys()][index] ?? null,
      removeItem: (key: string) => {
        map.delete(key);
      },
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    } as Storage;
  }

  it("returns null when nothing is stored", () => {
    expect(loadLastSnoozeOption(memoryStorage())).toBeNull();
  });

  it("round-trips a valid option", () => {
    const storage = memoryStorage();
    saveLastSnoozeOption("tomorrow", storage);
    expect(loadLastSnoozeOption(storage)).toBe("tomorrow");
  });

  it("ignores invalid stored values", () => {
    const storage = memoryStorage({ "pulse-inbox-last-snooze": "bogus" });
    expect(loadLastSnoozeOption(storage)).toBeNull();
  });
});
