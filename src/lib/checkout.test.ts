import { describe, expect, it } from "vitest";
import { checkoutCommand } from "./checkout";

describe("checkoutCommand", () => {
  it("builds a fetch + switch command from the PR number and branch", () => {
    expect(checkoutCommand(42, "feature/thing")).toBe(
      "git fetch origin pull/42/head:feature/thing && git switch feature/thing",
    );
  });

  it("strips unsafe characters from the branch name", () => {
    expect(checkoutCommand(7, "fix;rm -rf $(x)")).toBe(
      "git fetch origin pull/7/head:fixrm-rfx && git switch fixrm-rfx",
    );
  });

  it("falls back to pr-N when the branch name is empty after sanitizing", () => {
    expect(checkoutCommand(9, "!!!")).toBe("git fetch origin pull/9/head:pr-9 && git switch pr-9");
  });
});
