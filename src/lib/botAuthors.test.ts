import { describe, expect, it } from "vitest";
import { isBotLogin } from "./botAuthors";

describe("isBotLogin", () => {
  it.each([
    "dependabot",
    "Dependabot",
    "dependabot[bot]",
    "DEPENDABOT[bot]",
    "renovate",
    "Renovate[bot]",
    "github-actions[bot]",
    "GitHub-Actions[bot]",
    "codecov[bot]",
  ])("returns true for bot login %s", (login) => {
    expect(isBotLogin(login)).toBe(true);
  });

  it.each(["octocat", "human-dev", "  ", ""])("returns false for non-bot login %s", (login) => {
    expect(isBotLogin(login)).toBe(false);
  });
});
