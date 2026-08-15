import { describe, expect, it } from "vitest";
import { stepFileIndex } from "./fileNav";

describe("stepFileIndex", () => {
  it("moves forward and backward within bounds", () => {
    expect(stepFileIndex(0, 3, 1)).toBe(1);
    expect(stepFileIndex(1, 3, 1)).toBe(2);
    expect(stepFileIndex(2, 3, 1)).toBe(2);
    expect(stepFileIndex(0, 3, -1)).toBe(0);
    expect(stepFileIndex(2, 3, -1)).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(stepFileIndex(0, 0, 1)).toBe(0);
  });
});
