import { describe, expect, it } from "vitest";
import { focusAfterRemoval } from "./inboxFocus";

describe("focusAfterRemoval", () => {
  it("selects the next item when one remains after", () => {
    expect(focusAfterRemoval(["a", "b", "c"], "a")).toBe("b");
    expect(focusAfterRemoval(["a", "b", "c"], "b")).toBe("c");
  });

  it("selects the previous item when removing the last", () => {
    expect(focusAfterRemoval(["a", "b", "c"], "c")).toBe("b");
  });

  it("returns null when the list becomes empty", () => {
    expect(focusAfterRemoval(["a"], "a")).toBeNull();
  });
});
