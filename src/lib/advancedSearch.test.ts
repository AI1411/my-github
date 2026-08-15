import { describe, expect, it } from "vitest";
import {
  createSavedSearch,
  defaultSavedSearchName,
  isAdvancedSearchQuery,
  shouldRunGithubSearch,
} from "./advancedSearch";

describe("isAdvancedSearchQuery", () => {
  it("detects is: and repo: prefixes", () => {
    expect(isAdvancedSearchQuery("is:pr review-requested:@me")).toBe(true);
    expect(isAdvancedSearchQuery("repo:octocat/hello is:open")).toBe(true);
    expect(isAdvancedSearchQuery("  IS:issue ")).toBe(true);
  });

  it("rejects plain text queries", () => {
    expect(isAdvancedSearchQuery("fix build")).toBe(false);
    expect(isAdvancedSearchQuery("")).toBe(false);
    expect(isAdvancedSearchQuery("miss:pr")).toBe(false);
  });
});

describe("shouldRunGithubSearch", () => {
  it("runs for advanced queries regardless of length", () => {
    expect(shouldRunGithubSearch("is:pr", false)).toBe(true);
    expect(shouldRunGithubSearch("repo:a/b", false)).toBe(true);
  });

  it("runs in search mode for any non-empty query", () => {
    expect(shouldRunGithubSearch("ci", true)).toBe(true);
    expect(shouldRunGithubSearch("", true)).toBe(false);
  });

  it("keeps the length ≥ 3 rule for normal mode", () => {
    expect(shouldRunGithubSearch("ab", false)).toBe(false);
    expect(shouldRunGithubSearch("abc", false)).toBe(true);
  });
});

describe("createSavedSearch", () => {
  it("trims and returns name + query", () => {
    expect(createSavedSearch("  My PRs ", " is:pr ")).toEqual({
      name: "My PRs",
      query: "is:pr",
    });
  });

  it("returns null when name or query is blank", () => {
    expect(createSavedSearch("", "is:pr")).toBeNull();
    expect(createSavedSearch("My PRs", "  ")).toBeNull();
  });
});

describe("defaultSavedSearchName", () => {
  it("uses the query, truncated when long", () => {
    expect(defaultSavedSearchName("is:pr")).toBe("is:pr");
    const long = "is:pr ".repeat(20).trim();
    expect(defaultSavedSearchName(long).endsWith("…")).toBe(true);
    expect(defaultSavedSearchName(long).length).toBeLessThanOrEqual(48);
  });
});
