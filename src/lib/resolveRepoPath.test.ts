import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { repoPathCandidates, resolveRepoUnderRoots } from "./resolveRepoPath";

const mockedInvoke = vi.mocked(invoke);

describe("repoPathCandidates", () => {
  it("builds flat and owner/repo paths for each root", () => {
    expect(repoPathCandidates(["/Users/me/src"], "acme/widget")).toEqual([
      "/Users/me/src/widget",
      "/Users/me/src/acme/widget",
    ]);
  });

  it("strips trailing slashes from roots", () => {
    expect(repoPathCandidates(["/src/", "/code\\"], "o/r")).toEqual([
      "/src/r",
      "/src/o/r",
      "/code/r",
      "/code/o/r",
    ]);
  });

  it("returns empty for invalid full names", () => {
    expect(repoPathCandidates(["/src"], "invalid")).toEqual([]);
    expect(repoPathCandidates(["/src"], "/repo")).toEqual([]);
    expect(repoPathCandidates(["/src"], "  ")).toEqual([]);
  });

  it("skips blank roots", () => {
    expect(repoPathCandidates(["", "  ", "/src"], "o/r")).toEqual(["/src/r", "/src/o/r"]);
  });
});

describe("resolveRepoUnderRoots", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("returns null without invoking when full name is invalid", async () => {
    await expect(resolveRepoUnderRoots(["/src"], "bad")).resolves.toBeNull();
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("delegates to cmd_resolve_repo_path with roots and full name", async () => {
    mockedInvoke.mockResolvedValueOnce("/src/acme/widget");
    await expect(resolveRepoUnderRoots(["/src"], "acme/widget")).resolves.toBe(
      "/src/acme/widget",
    );
    expect(mockedInvoke).toHaveBeenCalledWith("cmd_resolve_repo_path", {
      roots: ["/src"],
      fullName: "acme/widget",
    });
  });

  it("returns null when cmd finds no clone", async () => {
    mockedInvoke.mockResolvedValueOnce(null);
    await expect(resolveRepoUnderRoots(["/src"], "acme/widget")).resolves.toBeNull();
  });
});
