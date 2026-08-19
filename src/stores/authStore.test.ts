import { beforeEach, describe, expect, it } from "vitest";
import { reportAuthFailure, useAuthStore } from "./authStore";

describe("authStore expired status", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
  });

  it("marks the session expired", () => {
    useAuthStore.getState().setExpired();
    expect(useAuthStore.getState()).toMatchObject({ user: null, status: "expired" });
  });

  it("reports 401 as expired and ignores network errors", () => {
    expect(reportAuthFailure("GitHub API error (HTTP 401): Bad credentials")).toBe(true);
    expect(useAuthStore.getState().status).toBe("expired");
    useAuthStore.setState({ user: { login: "octocat", avatar_url: "" }, status: "authenticated" });
    expect(reportAuthFailure("network error")).toBe(false);
    expect(useAuthStore.getState().status).toBe("authenticated");
  });
});
