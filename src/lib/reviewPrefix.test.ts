import { describe, expect, it } from "vitest";
import { formatReviewComment, REVIEW_PREFIXES } from "./reviewPrefix";

describe("REVIEW_PREFIXES", () => {
  it("contains the five team prefixes in order", () => {
    expect(REVIEW_PREFIXES.map((p) => p.label)).toEqual([
      "[must]",
      "[imo]",
      "[nits]",
      "[ask]",
      "[fyi]",
    ]);
  });
});

describe("formatReviewComment", () => {
  it("prepends the prefix to the body", () => {
    expect(formatReviewComment("must", "null チェックが必要です")).toBe(
      "[must] null チェックが必要です",
    );
  });

  it("trims the body", () => {
    expect(formatReviewComment("nits", "  typo  ")).toBe("[nits] typo");
  });

  it("returns just the prefix for an empty body", () => {
    expect(formatReviewComment("fyi", "   ")).toBe("[fyi]");
  });
});
