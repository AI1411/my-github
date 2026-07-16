import { describe, expect, it } from "vitest";
import {
  issueFilterToQuery,
  pullFilterToQuery,
  queryToIssueFilter,
  queryToPullFilter,
} from "./savedFilters";

describe("pull filter serialization", () => {
  it("round-trips a full pull filter", () => {
    const query = pullFilterToQuery({
      tab: "review",
      state: "closed",
      repoFullName: "octocat/hello",
      authorLogin: "alice",
      labels: ["bug", "p1"],
    });
    expect(queryToPullFilter(query)).toEqual({
      tab: "review",
      state: "closed",
      repoFullName: "octocat/hello",
      authorLogin: "alice",
      labels: ["bug", "p1"],
    });
  });

  it("omits defaults (tab=all, state=open) from the query", () => {
    expect(pullFilterToQuery({ tab: "all", state: "open" })).toBe("");
  });

  it("falls back to defaults for an empty or invalid query", () => {
    expect(queryToPullFilter("")).toEqual({ tab: "all", state: "open" });
    expect(queryToPullFilter("tab=bogus")).toEqual({ tab: "all", state: "open" });
  });

  it("parses the repo param used by existing breadcrumb links", () => {
    const filter = queryToPullFilter("repo=octocat/hello");
    expect(filter.repoFullName).toBe("octocat/hello");
  });
});

describe("issue filter serialization", () => {
  it("round-trips a full issue filter", () => {
    const query = issueFilterToQuery({
      state: "open",
      repoFullName: "octocat/hello",
      assigneeLogin: "bob",
      milestoneTitle: "v0.2",
      labels: ["docs"],
    });
    expect(queryToIssueFilter(query)).toEqual({
      state: "open",
      repoFullName: "octocat/hello",
      assigneeLogin: "bob",
      milestoneTitle: "v0.2",
      labels: ["docs"],
    });
  });

  it("returns an empty filter for an empty query", () => {
    expect(queryToIssueFilter("")).toEqual({ labels: [] });
  });
});
