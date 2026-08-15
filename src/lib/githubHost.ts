/** Default github.com host id / label. */
export const DEFAULT_GITHUB_HOST_ID = "github.com";

/** Public github.com API base. */
export const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

/** Public github.com web origin. */
export const DEFAULT_GITHUB_WEB_BASE = "https://github.com";

export interface GithubHost {
  id: string;
  /** REST API base URL (no trailing slash), e.g. https://api.github.com or https://ghes.example/api/v3 */
  baseUrl: string;
  /** Human-readable label shown in UI (usually hostname). */
  label: string;
}

export const DEFAULT_GITHUB_HOST: GithubHost = {
  id: DEFAULT_GITHUB_HOST_ID,
  baseUrl: DEFAULT_GITHUB_API_BASE,
  label: "github.com",
};

/**
 * Normalize a user-entered host / URL into a GitHub REST API base URL.
 *
 * - github.com (any scheme) → https://api.github.com
 * - https://github.example.com → https://github.example.com/api/v3
 * - already …/api/v3 or api.github.com → unchanged (trailing slash stripped)
 */
export function normalizeGithubApiBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_GITHUB_API_BASE;

  let raw = trimmed;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return DEFAULT_GITHUB_API_BASE;
  }

  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com" || host === "api.github.com") {
    return DEFAULT_GITHUB_API_BASE;
  }

  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname === "/api/v3" || pathname.endsWith("/api/v3")) {
    return `${url.protocol}//${url.host}${pathname === "/api/v3" ? "/api/v3" : pathname}`;
  }

  // GHES: enterprise host root → /api/v3
  return `${url.protocol}//${url.host}/api/v3`;
}

/**
 * Normalize a user-entered host into a stable web origin (no trailing slash).
 * Used for accountHosts metadata and UI display.
 */
export function normalizeGithubWebBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_GITHUB_WEB_BASE;

  let raw = trimmed;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return DEFAULT_GITHUB_WEB_BASE;
  }

  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com" || host === "api.github.com") {
    return DEFAULT_GITHUB_WEB_BASE;
  }

  // Strip /api/v3 if the user pasted an API URL
  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname === "/api/v3" || pathname.endsWith("/api/v3")) {
    pathname = pathname.replace(/\/api\/v3$/, "") || "";
  }

  return pathname && pathname !== "/"
    ? `${url.protocol}//${url.host}${pathname}`
    : `${url.protocol}//${url.host}`;
}

/** Short label for UI (hostname), falling back to github.com. */
export function hostDisplayLabel(baseUrl: string | undefined | null): string {
  if (!baseUrl) return DEFAULT_GITHUB_HOST_ID;
  try {
    const normalized = normalizeGithubWebBaseUrl(baseUrl);
    return new URL(normalized).hostname || DEFAULT_GITHUB_HOST_ID;
  } catch {
    return DEFAULT_GITHUB_HOST_ID;
  }
}

/** Ensure a hosts list entry exists for the given web/API base URL. */
export function hostEntryFromBaseUrl(baseUrl: string): GithubHost {
  const web = normalizeGithubWebBaseUrl(baseUrl);
  const api = normalizeGithubApiBaseUrl(baseUrl);
  const label = hostDisplayLabel(web);
  return {
    id: label,
    baseUrl: api,
    label,
  };
}
