import { describe, expect, it } from "vitest";
import { isAuthExpiredError } from "./authErrors";

describe("isAuthExpiredError", () => {
  it("detects GitHub 401 and expired PAT messages", () => {
    expect(isAuthExpiredError("GitHub API error (HTTP 401): Bad credentials")).toBe(true);
    expect(isAuthExpiredError("invalid or expired PAT (HTTP 401)")).toBe(true);
    expect(isAuthExpiredError("Bad credentials")).toBe(true);
  });

  it("does not treat network failures as expired", () => {
    expect(isAuthExpiredError("network error")).toBe(false);
    expect(isAuthExpiredError("HTTP request failed: error sending request")).toBe(false);
    expect(isAuthExpiredError("offline")).toBe(false);
    expect(isAuthExpiredError("Error: timed out")).toBe(false);
  });
});
