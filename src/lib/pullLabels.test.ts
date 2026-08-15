import { describe, expect, it } from "vitest";
import { pullMatchesLabels, uniquePullLabels } from "./pullLabels";

describe("uniquePullLabels", () => {
  it("collects sorted unique names", () => {
    expect(
      uniquePullLabels([{ labels: ["bug", "docs"] }, { labels: ["bug"] }, { labels: [] }, {}]),
    ).toEqual(["bug", "docs"]);
  });
});

describe("pullMatchesLabels", () => {
  it("requires every selected label", () => {
    expect(pullMatchesLabels({ labels: ["bug", "p1"] }, ["bug"])).toBe(true);
    expect(pullMatchesLabels({ labels: ["bug"] }, ["bug", "p1"])).toBe(false);
    expect(pullMatchesLabels({ labels: ["bug"] }, [])).toBe(true);
  });
});
