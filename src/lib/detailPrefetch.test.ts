import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  clearPrefetchCache,
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
});
