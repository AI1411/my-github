import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  isReviewRequestStale,
  nextReviewQueueIndex,
  reviewQueueDetailPath,
} from "./reviewQueue";
import { DEFAULT_STALE_THRESHOLDS } from "./stalePulls";
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

function pull(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 1,
    number: 42,
    title: "Review me",
    repo: "octocat/hello",
    author: "other",
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

describe("isReviewRequestStale", () => {
  it("flags items older than reviewRequestDays", () => {
    expect(
      isReviewRequestStale(
        reviewRequest({ updatedAt: "2026-07-10T12:00:00Z" }),
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toBe(true);
    expect(
      isReviewRequestStale(
        reviewRequest({ updatedAt: "2026-07-15T12:00:00Z" }),
        DEFAULT_STALE_THRESHOLDS,
        now,
      ),
    ).toBe(false);
  });
});

describe("buildReviewQueue", () => {
  it("sorts CI failure first, then stale, then others", () => {
    const fresh = reviewRequest({
      id: "fresh",
      number: 1,
      title: "Fresh",
      updatedAt: "2026-07-15T12:00:00Z",
    });
    const stale = reviewRequest({
      id: "stale",
      number: 2,
      title: "Stale",
      updatedAt: "2026-07-10T12:00:00Z",
    });
    const failing = reviewRequest({
      id: "fail",
      number: 3,
      title: "CI fail",
      updatedAt: "2026-07-14T12:00:00Z",
    });
    const staleFailing = reviewRequest({
      id: "stale-fail",
      number: 4,
      title: "Stale CI fail",
      updatedAt: "2026-07-01T12:00:00Z",
    });

    const queue = buildReviewQueue({
      reviewRequests: [fresh, stale, failing, staleFailing],
      pulls: [
        pull({ number: 1, ciState: "success" }),
        pull({ number: 2, ciState: "success" }),
        pull({ number: 3, ciState: "failure" }),
        pull({ number: 4, ciState: "error" }),
      ],
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });

    expect(queue.map((e) => e.item.id)).toEqual([
      "stale-fail",
      "fail",
      "stale",
      "fresh",
    ]);
    expect(queue[0].ciFailing).toBe(true);
    expect(queue[0].stale).toBe(true);
    expect(queue[1].ciFailing).toBe(true);
    expect(queue[1].stale).toBe(false);
    expect(queue[2].ciFailing).toBe(false);
    expect(queue[2].stale).toBe(true);
    expect(queue[3].ciFailing).toBe(false);
    expect(queue[3].stale).toBe(false);
  });

  it("orders older items first within the same priority band", () => {
    const olderFail = reviewRequest({
      id: "older",
      number: 1,
      updatedAt: "2026-07-01T12:00:00Z",
    });
    const newerFail = reviewRequest({
      id: "newer",
      number: 2,
      updatedAt: "2026-07-12T12:00:00Z",
    });

    const queue = buildReviewQueue({
      reviewRequests: [newerFail, olderFail],
      pulls: [
        pull({ number: 1, ciState: "failure" }),
        pull({ number: 2, ciState: "failure" }),
      ],
      thresholds: DEFAULT_STALE_THRESHOLDS,
      now,
    });

    expect(queue.map((e) => e.item.id)).toEqual(["older", "newer"]);
  });
});

describe("nextReviewQueueIndex", () => {
  it("advances and wraps", () => {
    expect(nextReviewQueueIndex(0, 3)).toBe(1);
    expect(nextReviewQueueIndex(1, 3)).toBe(2);
    expect(nextReviewQueueIndex(2, 3)).toBe(0);
  });

  it("stays at 0 for empty or single-item queues", () => {
    expect(nextReviewQueueIndex(0, 0)).toBe(0);
    expect(nextReviewQueueIndex(0, 1)).toBe(0);
  });
});

describe("reviewQueueDetailPath", () => {
  it("builds a pulls detail path", () => {
    expect(reviewQueueDetailPath(reviewRequest())).toBe("/pulls/octocat/hello/42");
  });

  it("returns null without a number", () => {
    expect(reviewQueueDetailPath(reviewRequest({ number: null }))).toBeNull();
  });
});
