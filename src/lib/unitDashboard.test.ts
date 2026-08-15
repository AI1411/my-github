import { describe, expect, it } from "vitest";
import type { IssueSummary, PullSummary } from "../stores/dataStore";
import {
  collectDashboardOrgs,
  collectDashboardRepos,
  reposForOrg,
  summarizeUnitDashboard,
} from "./unitDashboard";

function pull(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 1,
    number: 1,
    title: "PR",
    repo: "acme/app",
    author: "dev",
    state: "open",
    isDraft: false,
    headRef: "feature",
    baseRef: "main",
    updatedAt: "2026-08-01T00:00:00Z",
    htmlUrl: null,
    ciState: null,
    reviewState: null,
    hasMention: false,
    requestedReviewers: [],
    mergedAt: null,
    additions: null,
    deletions: null,
    changedFiles: null,
    ...overrides,
  };
}

function issue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: 10,
    number: 10,
    title: "Issue",
    repo: "acme/app",
    author: "dev",
    state: "open",
    labels: [],
    assignees: [],
    milestone: null,
    comments: 0,
    updatedAt: "2026-08-01T00:00:00Z",
    htmlUrl: null,
    body: null,
    ...overrides,
  };
}

describe("collectDashboardRepos", () => {
  it("unions watched repos with pull/issue repos and sorts", () => {
    expect(
      collectDashboardRepos({
        watchedRepositories: ["zeta/z", "acme/app"],
        pulls: [pull({ repo: "beta/b" })],
        issues: [issue({ repo: "acme/app" }), issue({ repo: "acme/other" })],
      }),
    ).toEqual(["acme/app", "acme/other", "beta/b", "zeta/z"]);
  });
});

describe("collectDashboardOrgs / reposForOrg", () => {
  it("groups by owner prefix", () => {
    const repos = ["acme/app", "acme/other", "beta/b"];
    expect(collectDashboardOrgs(repos)).toEqual(["acme", "beta"]);
    expect(reposForOrg(repos, "acme")).toEqual(["acme/app", "acme/other"]);
  });
});

describe("summarizeUnitDashboard", () => {
  it("counts open PRs, open issues, and CI failures", () => {
    const result = summarizeUnitDashboard({
      pulls: [
        pull({ id: 1, ciState: "failure" }),
        pull({ id: 2, ciState: "error" }),
        pull({ id: 3, ciState: "success" }),
        pull({ id: 4, state: "closed", ciState: "failure" }),
      ],
      issues: [
        issue({ id: 1 }),
        issue({ id: 2, state: "closed" }),
        issue({ id: 3 }),
      ],
    });
    expect(result).toEqual({ openPrs: 3, openIssues: 2, ciFailures: 2 });
  });

  it("filters by repo full_name when repos provided", () => {
    const result = summarizeUnitDashboard({
      pulls: [
        pull({ id: 1, repo: "acme/app", ciState: "failure" }),
        pull({ id: 2, repo: "beta/b", ciState: "failure" }),
      ],
      issues: [
        issue({ id: 1, repo: "acme/app" }),
        issue({ id: 2, repo: "beta/b" }),
      ],
      repos: ["acme/app"],
    });
    expect(result).toEqual({ openPrs: 1, openIssues: 1, ciFailures: 1 });
  });

  it("treats empty repos filter as all", () => {
    const result = summarizeUnitDashboard({
      pulls: [pull()],
      issues: [issue()],
      repos: [],
    });
    expect(result).toEqual({ openPrs: 1, openIssues: 1, ciFailures: 0 });
  });
});
