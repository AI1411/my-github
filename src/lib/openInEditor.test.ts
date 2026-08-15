import { describe, expect, it } from "vitest";
import { normalizeRepoPathMap } from "./openInEditor";

describe("normalizeRepoPathMap", () => {
  it("keeps valid owner/repo → path entries", () => {
    expect(
      normalizeRepoPathMap({
        "acme/app": "/Users/me/src/app",
        bad: "/tmp",
        "x/y": "  ",
      }),
    ).toEqual({ "acme/app": "/Users/me/src/app" });
  });
});
