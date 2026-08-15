import { describe, expect, it } from "vitest";
import { homePathForLayout, resolveTheme } from "./appearance";

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
