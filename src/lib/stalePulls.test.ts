import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALE_THRESHOLDS,
  findStaleItems,
  isOwnPullStale,
  staleItemDescription,
} from "./stalePulls";
import type { InboxItem, PullSummary } from "../stores/dataStore";

const now = new Date("2026-07-16T12:00:00Z");

function reviewRequest(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "PR_1",
    kind: "review_requested",
    repo: "octocat/hello",
    number: 42,
    title: "Review me",
    htmlUrl: "https://github.com/octocat/hello/pull/42",
    updatedAt: "2026-07-15T12:00:00Z",
    unread: true,
    pinned: false,
    ...overrides,
  };
}

function ownPull(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 1,
    number: 10,
    title: "My pull",
    repo: "octocat/hello",
    author: "me",
    state: "open",
    isDraft: false,
    headRef: "feature",
    baseRef: "main",
    updatedAt: "2026-07-01T12:00:00Z",
    htmlUrl: "https://github.com/octocat/hello/pull/10",
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

describe("findStaleItems", () => {
  it("flags review requests older than the threshold", () => {
    const items = findStaleItems({
      inbox: {
        reviewRequests: [
          reviewRequest({ id: "old", updatedAt: "2026-07-10T12:00:00Z" }),
          reviewRequest({ id: "fresh", updatedAt: "2026-07-15T12:00:00Z" }),
        ],
      },
      pulls: [],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("stale-old");
    expect(items[0].kind).toBe("stale_review_request");
  });

  it("flags my open pulls with no activity past the threshold", () => {
    const items = findStaleItems({
      inbox: { reviewRequests: [] },
      pulls: [ownPull({ updatedAt: "2026-07-01T12:00:00Z" })],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("stale_own_pull");
    expect(items[0].id).toBe("stale-own-octocat/hello-10");
  });

  it("ignores drafts, closed, approved, merged, and other authors", () => {
    const items = findStaleItems({
      inbox: { reviewRequests: [] },
      pulls: [
        ownPull({ number: 1, isDraft: true }),
        ownPull({ number: 2, state: "closed" }),
        ownPull({ number: 3, reviewState: "approved" }),
        ownPull({ number: 4, mergedAt: "2026-07-02T00:00:00Z" }),
        ownPull({ number: 5, author: "someone-else" }),
      ],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items).toHaveLength(0);
  });

  it("skips own-pull detection when the user is unknown", () => {
    const items = findStaleItems({
      inbox: { reviewRequests: [] },
      pulls: [ownPull()],
      currentUser: null,
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items).toHaveLength(0);
  });

  it("sorts oldest first", () => {
    const items = findStaleItems({
      inbox: {
        reviewRequests: [
          reviewRequest({ id: "newer", updatedAt: "2026-07-12T12:00:00Z" }),
          reviewRequest({ id: "older", updatedAt: "2026-07-01T12:00:00Z" }),
        ],
      },
      pulls: [],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items.map((i) => i.id)).toEqual(["stale-older", "stale-newer"]);
  });

  it("handles a null inbox", () => {
    const items = findStaleItems({
      inbox: null,
      pulls: [],
      currentUser: "me",
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });
    expect(items).toHaveLength(0);
  });
});

describe("staleItemDescription", () => {
  it("describes both stale kinds", () => {
    expect(staleItemDescription("stale_review_request")).toMatch(/review/i);
    expect(staleItemDescription("stale_own_pull")).toMatch(/no activity/i);
  });
});

describe("isOwnPullStale", () => {
  it("marks old own open pulls as stale", () => {
    expect(isOwnPullStale(ownPull(), "me", DEFAULT_STALE_THRESHOLDS, now)).toBe(true);
  });

  it("ignores other authors and fresh pulls", () => {
    expect(isOwnPullStale(ownPull({ author: "other" }), "me", DEFAULT_STALE_THRESHOLDS, now)).toBe(
      false,
    );
    expect(
      isOwnPullStale(
        ownPull({ updatedAt: "2026-07-15T12:00:00Z" }),
        "me",
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toBe(false);
  });
});
