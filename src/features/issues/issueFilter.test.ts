import { describe, it, expect } from "vitest";
import {
  type IssueFilter,
  toggleLabel,
  withState,
  clearFilter,
  isFilterEmpty,
} from "./issueFilter";

describe("issueFilter", () => {
  it("toggleLabel adds when missing", () => {
    const f: IssueFilter = { labels: [] };
    expect(toggleLabel(f, "bug")).toEqual({ labels: ["bug"] });
  });

  it("toggleLabel removes when present", () => {
    const f: IssueFilter = { labels: ["bug", "p0"] };
    expect(toggleLabel(f, "bug")).toEqual({ labels: ["p0"] });
  });

  it("withState replaces state", () => {
    const f: IssueFilter = { labels: [], state: "open" };
    expect(withState(f, "closed").state).toBe("closed");
  });

  it("clearFilter resets to empty labels and undefined fields", () => {
    const cleared = clearFilter({
      labels: ["bug"],
      state: "open",
      repoFullName: "o/r",
      assigneeLogin: "alice",
      milestoneTitle: "v1",
    });
    expect(cleared).toEqual({ labels: [] });
  });

  it("isFilterEmpty returns true only when no constraints", () => {
    expect(isFilterEmpty({ labels: [] })).toBe(true);
    expect(isFilterEmpty({ labels: ["bug"] })).toBe(false);
    expect(isFilterEmpty({ labels: [], state: "open" })).toBe(false);
  });
});
