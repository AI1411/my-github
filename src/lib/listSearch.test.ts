import { describe, expect, it } from "vitest";
import { loadListSearchQuery, matchesListSearch, saveListSearchQuery } from "./listSearch";

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

describe("listSearch persistence", () => {
  it("round-trips per account and route", () => {
    const storage = memoryStorage();
    saveListSearchQuery("alice", "pulls", "ci", storage);
    saveListSearchQuery("alice", "issues", "bug", storage);
    saveListSearchQuery("bob", "pulls", "other", storage);
    expect(loadListSearchQuery("alice", "pulls", storage)).toBe("ci");
    expect(loadListSearchQuery("alice", "issues", storage)).toBe("bug");
    expect(loadListSearchQuery("bob", "pulls", storage)).toBe("other");
  });

  it("clears stored query when empty", () => {
    const storage = memoryStorage();
    saveListSearchQuery("alice", "pulls", "ci", storage);
    saveListSearchQuery("alice", "pulls", "", storage);
    expect(loadListSearchQuery("alice", "pulls", storage)).toBe("");
  });
});

describe("matchesListSearch", () => {
  it("matches case-insensitively and treats empty as all", () => {
    expect(matchesListSearch("Fix CI", "")).toBe(true);
    expect(matchesListSearch("Fix CI", "ci")).toBe(true);
    expect(matchesListSearch("Fix CI", "bug")).toBe(false);
  });
});
