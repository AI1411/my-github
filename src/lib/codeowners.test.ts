import { describe, expect, it } from "vitest";
import {
  computeReviewGaps,
  matchCodeowners,
  parseCodeowners,
  uniqueOwners,
} from "./codeowners";

describe("parseCodeowners", () => {
  it("ignores comments and blank lines", () => {
    const rules = parseCodeowners(`
# comment
* @org/everyone
/docs/ @docs-team
*.rs @rustaceans
`);
    expect(rules).toEqual([
      { pattern: "*", owners: ["@org/everyone"] },
      { pattern: "/docs/", owners: ["@docs-team"] },
      { pattern: "*.rs", owners: ["@rustaceans"] },
    ]);
  });
});

describe("matchCodeowners", () => {
  it("uses last matching rule", () => {
    const rules = parseCodeowners(`
* @org/all
src/** @org/frontend
src/lib/*.ts @alice
`);
    expect(matchCodeowners("src/lib/codeowners.ts", rules)).toMatchObject({
      owners: ["@alice"],
      pattern: "src/lib/*.ts",
    });
    expect(matchCodeowners("README.md", rules).owners).toEqual(["@org/all"]);
  });
});

describe("uniqueOwners / computeReviewGaps", () => {
  it("collects unique owners", () => {
    expect(
      uniqueOwners([
        { path: "a", owners: ["@a", "@b"], pattern: "*" },
        { path: "b", owners: ["@b"], pattern: "*" },
      ]),
    ).toEqual(["@a", "@b"]);
  });

  it("lists unmet user/team/codeowner gaps", () => {
    const gaps = computeReviewGaps({
      requestedReviewers: ["bob"],
      requestedTeams: ["acme/platform"],
      requiredOwners: ["@alice", "@acme/platform"],
      approvedLogins: ["carol"],
    });
    expect(gaps.map((g) => g.name)).toEqual([
      "bob",
      "acme/platform",
      "@alice",
    ]);
  });

  it("skips codeowner already requested as team", () => {
    const gaps = computeReviewGaps({
      requestedReviewers: [],
      requestedTeams: ["acme/platform"],
      requiredOwners: ["@acme/platform"],
      approvedLogins: [],
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe("team");
  });
});
