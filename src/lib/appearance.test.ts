import { describe, expect, it } from "vitest";
import { homePathForLayout, listRowHeight, resolveTheme } from "./appearance";

describe("resolveTheme", () => {
  it("resolves system from prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("homePathForLayout", () => {
  it("maps layout presets to routes", () => {
    expect(homePathForLayout("inbox-first")).toBe("/inbox");
    expect(homePathForLayout("pulls-first")).toBe("/pulls");
  });
});

describe("listRowHeight", () => {
  it("uses a shorter row in compact density", () => {
    expect(listRowHeight("compact")).toBe(40);
    expect(listRowHeight("comfortable")).toBe(56);
  });
});
