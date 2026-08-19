import { describe, expect, it } from "vitest";
import { buildCodeSearchQuery, buildFileJumpUrl } from "./codeSearch";

describe("buildCodeSearchQuery", () => {
  it("appends repo:owner/name to the query", () => {
    expect(buildCodeSearchQuery("fn ping", "octocat/hello")).toBe("fn ping repo:octocat/hello");
    expect(buildCodeSearchQuery("  path:src  ", "o/r")).toBe("path:src repo:o/r");
  });

  it("returns null when query or repo is blank", () => {
    expect(buildCodeSearchQuery("", "o/r")).toBeNull();
    expect(buildCodeSearchQuery("ping", "  ")).toBeNull();
    expect(buildCodeSearchQuery("  ", "")).toBeNull();
  });
});

describe("buildFileJumpUrl", () => {
  it("builds a blob/HEAD URL and strips leading slashes", () => {
    expect(buildFileJumpUrl("octocat/hello", "src/lib.rs")).toBe(
      "https://github.com/octocat/hello/blob/HEAD/src/lib.rs",
    );
    expect(buildFileJumpUrl("o/r", "/docs/readme.md")).toBe(
      "https://github.com/o/r/blob/HEAD/docs/readme.md",
    );
  });

  it("returns null when repo or path is blank", () => {
    expect(buildFileJumpUrl("", "src/a.ts")).toBeNull();
    expect(buildFileJumpUrl("o/r", "  ")).toBeNull();
  });
});
