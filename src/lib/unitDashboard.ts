import type { IssueSummary, PullSummary } from "../stores/dataStore";

export interface UnitDashboardCounts {
  openPrs: number;
  openIssues: number;
  ciFailures: number;
}

function isCiFailing(ciState: string | null | undefined): boolean {
  return ciState === "failure" || ciState === "error";
}

/** Collect unique repo full_names from watched list + cached pulls/issues. */
export function collectDashboardRepos(params: {
  watchedRepositories: string[];
  pulls: Array<{ repo: string }>;
  issues: Array<{ repo: string }>;
}): string[] {
  const set = new Set<string>();
  for (const repo of params.watchedRepositories) {
    if (repo) set.add(repo);
  }
  for (const pull of params.pulls) {
    if (pull.repo) set.add(pull.repo);
  }
  for (const issue of params.issues) {
    if (issue.repo) set.add(issue.repo);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Unique owner prefixes (`owner` from `owner/repo`). */
export function collectDashboardOrgs(repos: string[]): string[] {
  const set = new Set<string>();
  for (const repo of repos) {
    const owner = repo.split("/")[0];
    if (owner) set.add(owner);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Repos belonging to an org/owner prefix. */
export function reposForOrg(repos: string[], org: string): string[] {
  const prefix = `${org}/`;
  return repos.filter((r) => r.startsWith(prefix));
}

/**
 * Summarize open PRs, open issues, and CI failures from cached data.
 * When `repos` is empty, counts everything. Otherwise filter to those full_names.
 */
export function summarizeUnitDashboard(params: {
  pulls: PullSummary[];
  issues: IssueSummary[];
  repos?: string[] | null;
}): UnitDashboardCounts {
  const repoFilter =
    params.repos && params.repos.length > 0 ? new Set(params.repos) : null;

  let openPrs = 0;
  let ciFailures = 0;
  for (const pull of params.pulls) {
    if (repoFilter && !repoFilter.has(pull.repo)) continue;
    if (pull.state !== "open") continue;
    openPrs += 1;
    if (isCiFailing(pull.ciState)) ciFailures += 1;
  }

  let openIssues = 0;
  for (const issue of params.issues) {
    if (repoFilter && !repoFilter.has(issue.repo)) continue;
    if (issue.state !== "open") continue;
    openIssues += 1;
  }

  return { openPrs, openIssues, ciFailures };
}
