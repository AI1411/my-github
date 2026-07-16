import { beforeEach, describe, expect, it } from "vitest";
import {
  findNewReleases,
  hasSeenReleases,
  loadSeenReleaseIds,
  releaseToNotification,
  saveSeenReleaseIds,
} from "./releases";
import type { ReleaseSummary } from "../stores/dataStore";

function release(overrides: Partial<ReleaseSummary> = {}): ReleaseSummary {
  return {
    id: 1,
    repo: "octocat/hello",
    tagName: "v1.0.0",
    name: "First release",
    prerelease: false,
    publishedAt: "2026-07-01T00:00:00Z",
    htmlUrl: "https://github.com/octocat/hello/releases/tag/v1.0.0",
    ...overrides,
  };
}

describe("releaseToNotification", () => {
  it("maps a release to a Release-type notification", () => {
    const n = releaseToNotification(release());
    expect(n.id).toBe("release-1");
    expect(n.reason).toBe("release");
    expect(n.subjectType).toBe("Release");
    expect(n.subjectTitle).toBe("v1.0.0 — First release");
    expect(n.updatedAt).toBe("2026-07-01T00:00:00Z");
    expect(n.unread).toBe(false);
  });

  it("omits the name suffix when it matches the tag or is null", () => {
    expect(releaseToNotification(release({ name: null })).subjectTitle).toBe("v1.0.0");
    expect(releaseToNotification(release({ name: "v1.0.0" })).subjectTitle).toBe("v1.0.0");
  });
});

describe("findNewReleases", () => {
  it("returns releases whose ID is not yet seen", () => {
    const items = [release({ id: 1 }), release({ id: 2 })];
    expect(findNewReleases(items, new Set([1]))).toEqual([items[1]]);
  });
});

describe("seen-release storage", () => {
  beforeEach(() => localStorage.clear());

  it("reports first run until IDs are saved", () => {
    expect(hasSeenReleases()).toBe(false);
    saveSeenReleaseIds(new Set([1, 2]));
    expect(hasSeenReleases()).toBe(true);
    expect(loadSeenReleaseIds()).toEqual(new Set([1, 2]));
  });

  it("returns an empty set for corrupt storage", () => {
    localStorage.setItem("pulse-seen-release-ids", "not-json");
    expect(loadSeenReleaseIds()).toEqual(new Set());
  });
});
