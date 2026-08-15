import { describe, expect, it } from "vitest";
import {
  DEFAULT_GITHUB_API_BASE,
  DEFAULT_GITHUB_WEB_BASE,
  hostDisplayLabel,
  hostEntryFromBaseUrl,
  normalizeGithubApiBaseUrl,
  normalizeGithubWebBaseUrl,
} from "./githubHost";

describe("normalizeGithubApiBaseUrl", () => {
  it("maps empty / github.com variants to api.github.com", () => {
    expect(normalizeGithubApiBaseUrl("")).toBe(DEFAULT_GITHUB_API_BASE);
    expect(normalizeGithubApiBaseUrl("github.com")).toBe(DEFAULT_GITHUB_API_BASE);
    expect(normalizeGithubApiBaseUrl("https://github.com")).toBe(DEFAULT_GITHUB_API_BASE);
    expect(normalizeGithubApiBaseUrl("https://www.github.com/")).toBe(DEFAULT_GITHUB_API_BASE);
    expect(normalizeGithubApiBaseUrl("https://api.github.com")).toBe(DEFAULT_GITHUB_API_BASE);
  });

  it("maps GHES web URL to /api/v3", () => {
    expect(normalizeGithubApiBaseUrl("https://github.example.com")).toBe(
      "https://github.example.com/api/v3",
    );
    expect(normalizeGithubApiBaseUrl("https://github.example.com/")).toBe(
      "https://github.example.com/api/v3",
    );
    expect(normalizeGithubApiBaseUrl("github.example.com")).toBe(
      "https://github.example.com/api/v3",
    );
  });

  it("preserves an explicit /api/v3 path", () => {
    expect(normalizeGithubApiBaseUrl("https://github.example.com/api/v3")).toBe(
      "https://github.example.com/api/v3",
    );
    expect(normalizeGithubApiBaseUrl("https://github.example.com/api/v3/")).toBe(
      "https://github.example.com/api/v3",
    );
  });
});

describe("normalizeGithubWebBaseUrl", () => {
  it("defaults to github.com", () => {
    expect(normalizeGithubWebBaseUrl("")).toBe(DEFAULT_GITHUB_WEB_BASE);
    expect(normalizeGithubWebBaseUrl("api.github.com")).toBe(DEFAULT_GITHUB_WEB_BASE);
  });

  it("keeps GHES origin and strips /api/v3", () => {
    expect(normalizeGithubWebBaseUrl("https://github.example.com/api/v3")).toBe(
      "https://github.example.com",
    );
    expect(normalizeGithubWebBaseUrl("github.example.com")).toBe("https://github.example.com");
  });
});

describe("hostDisplayLabel / hostEntryFromBaseUrl", () => {
  it("returns hostname for display", () => {
    expect(hostDisplayLabel(undefined)).toBe("github.com");
    expect(hostDisplayLabel("https://github.example.com")).toBe("github.example.com");
  });

  it("builds a host catalog entry", () => {
    expect(hostEntryFromBaseUrl("https://github.example.com")).toEqual({
      id: "github.example.com",
      baseUrl: "https://github.example.com/api/v3",
      label: "github.example.com",
    });
  });
});
