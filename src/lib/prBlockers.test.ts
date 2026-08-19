import { describe, expect, it } from "vitest";
import {
  buildOwnPrBlockers,
  classifyOwnPullBlockers,
  filterPrBlockers,
  prBlockerDetailPath,
  togglePrBlockerFilter,
} from "./prBlockers";
import { DEFAULT_STALE_THRESHOLDS } from "./stalePulls";
import type { PullSummary } from "../stores/dataStore";

const now = new Date("2026-07-16T12:00:00Z");

function pull(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 1,
    number: 42,
    title: "My PR",
    repo: "octocat/hello",
    author: "me",
    state: "open",
    isDraft: false,
    headRef: "feature",
    baseRef: "main",
    updatedAt: "2026-07-15T12:00:00Z",
    htmlUrl: "https://github.com/octocat/hello/pull/42",
    ciState: null,
    reviewState: "review_required",
    hasMention: false,
    requestedReviewers: [],
    mergedAt: null,
    additions: null,
    deletions: null,
    changedFiles: null,
    ...overrides,
  };
}

describe("classifyOwnPullBlockers", () => {
  it("returns empty for non-own or non-open pulls", () => {
    expect(
      classifyOwnPullBlockers(
        pull({ author: "other", ciState: "failure" }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toEqual([]);
    expect(
      classifyOwnPullBlockers(
        pull({ state: "closed", ciState: "failure" }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toEqual([]);
  });

  it("classifies CI fail, changes requested, and stale", () => {
    expect(
      classifyOwnPullBlockers(pull({ ciState: "failure" }), "me", DEFAULT_STALE_THRESHOLDS, now),
    ).toEqual(["ci_fail"]);

    expect(
      classifyOwnPullBlockers(
        pull({ reviewState: "changes_requested" }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toEqual(["changes_requested"]);

    expect(
      classifyOwnPullBlockers(
        pull({ updatedAt: "2026-07-01T12:00:00Z" }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toEqual(["stale"]);
  });

  it("can stack multiple blocker kinds", () => {
    expect(
      classifyOwnPullBlockers(
        pull({
          ciState: "error",
          reviewState: "changes_requested",
          updatedAt: "2026-07-01T12:00:00Z",
        }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toEqual(["ci_fail", "changes_requested", "stale"]);
  });
});

describe("buildOwnPrBlockers", () => {
  it("keeps only blocked own open PRs and sorts by blocker count then age", () => {
    const clean = pull({ id: 1, number: 1, title: "Clean" });
    const ciOnly = pull({
      id: 2,
      number: 2,
      title: "CI",
      ciState: "failure",
      updatedAt: "2026-07-14T12:00:00Z",
    });
    const multi = pull({
      id: 3,
      number: 3,
      title: "Multi",
      ciState: "failure",
      reviewState: "changes_requested",
      updatedAt: "2026-07-15T12:00:00Z",
    });
    const otherAuthor = pull({
      id: 4,
      number: 4,
      author: "other",
      ciState: "failure",
    });

    const entries = buildOwnPrBlockers({
      pulls: [clean, ciOnly, multi, otherAuthor],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });

    expect(entries.map((e) => e.pull.number)).toEqual([3, 2]);
    expect(entries[0].blockers).toEqual(["ci_fail", "changes_requested"]);
    expect(entries[1].blockers).toEqual(["ci_fail"]);
  });
});

describe("filterPrBlockers", () => {
  const entries = buildOwnPrBlockers({
    pulls: [
      pull({ id: 1, number: 1, ciState: "failure" }),
      pull({ id: 2, number: 2, reviewState: "changes_requested" }),
      pull({ id: 3, number: 3, updatedAt: "2026-07-01T12:00:00Z" }),
    ],
    currentUser: "me",
    thresholds: DEFAULT_STALE_THRESHOLDS,
    now,
  });

  it("returns all when no chips are active", () => {
    expect(
      filterPrBlockers(entries, [])
        .map((e) => e.pull.number)
        .sort(),
    ).toEqual([1, 2, 3]);
  });

  it("filters by selected kinds (OR)", () => {
    expect(filterPrBlockers(entries, ["ci_fail"]).map((e) => e.pull.number)).toEqual([1]);
    expect(
      filterPrBlockers(entries, ["changes_requested", "stale"])
        .map((e) => e.pull.number)
        .sort(),
    ).toEqual([2, 3]);
  });
});

describe("togglePrBlockerFilter", () => {
  it("adds and removes kinds", () => {
    expect(togglePrBlockerFilter([], "ci_fail")).toEqual(["ci_fail"]);
    expect(togglePrBlockerFilter(["ci_fail", "stale"], "ci_fail")).toEqual(["stale"]);
  });
});

describe("prBlockerDetailPath", () => {
  it("builds a pulls detail path", () => {
    expect(prBlockerDetailPath(pull())).toBe("/pulls/octocat/hello/42");
  });

  it("returns null for malformed repo", () => {
    expect(prBlockerDetailPath(pull({ repo: "solo" }))).toBeNull();
  });
});
