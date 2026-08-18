import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  clearPrefetchCache,
  getPrefetchPromise,
  hasPrefetch,
  prefetchIssueDetail,
  prefetchPullDetail,
} from "./detailPrefetch";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("detailPrefetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPrefetchCache();
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("prefetches pull files once per key", () => {
    prefetchPullDetail("o", "r", 1);
    prefetchPullDetail("o", "r", 1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("cmd_get_pull_files", {
      owner: "o",
      repo: "r",
      number: 1,
    });
    expect(hasPrefetch("pull", "o", "r", 1)).toBe(true);
  });

  it("prefetches issues separately", () => {
    prefetchIssueDetail("o", "r", 2);
    expect(invoke).toHaveBeenCalledWith("cmd_get_issue", {
      owner: "o",
      repo: "r",
      number: 2,
    });
  });

  it("returns cached prefetch promises", async () => {
    const issue = { id: 1, number: 2, title: "x", repo: "o/r" };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(issue);
    prefetchIssueDetail("o", "r", 2);
    const cached = getPrefetchPromise("issue", "o", "r", 2);
    await expect(cached).resolves.toEqual(issue);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
