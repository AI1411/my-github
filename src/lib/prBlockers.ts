import type { PullSummary } from "../stores/dataStore";
import { isOwnPullStale, type StaleThresholds } from "./stalePulls";

export type PrBlockerKind = "ci_fail" | "changes_requested" | "stale";

export const PR_BLOCKER_KINDS: PrBlockerKind[] = ["ci_fail", "changes_requested", "stale"];

export const PR_BLOCKER_LABELS: Record<PrBlockerKind, string> = {
  ci_fail: "CI failing",
  changes_requested: "Changes requested",
  stale: "Stale",
};

export interface PrBlockerEntry {
  pull: PullSummary;
  blockers: PrBlockerKind[];
}

function isCiFailing(ciState: string | null | undefined): boolean {
  return ciState === "failure" || ciState === "error";
}

/** Classify blocker kinds on one of the current user's open PRs. */
export function classifyOwnPullBlockers(
  pull: PullSummary,
  currentUser: string | null,
  thresholds: StaleThresholds,
  now: Date = new Date(),
): PrBlockerKind[] {
  if (!currentUser) return [];
  if (pull.state !== "open") return [];
  if (pull.author !== currentUser) return [];

  const blockers: PrBlockerKind[] = [];
  if (isCiFailing(pull.ciState)) blockers.push("ci_fail");
  if (pull.reviewState === "changes_requested") blockers.push("changes_requested");
  if (isOwnPullStale(pull, currentUser, thresholds, now)) blockers.push("stale");
  return blockers;
}

/**
 * Own open PRs that have at least one blocker.
 * Sorted: more blockers first, then older updatedAt.
 */
export function buildOwnPrBlockers(params: {
  pulls: PullSummary[];
  currentUser: string | null;
  thresholds: StaleThresholds;
  now?: Date;
}): PrBlockerEntry[] {
  const now = params.now ?? new Date();
  const entries: PrBlockerEntry[] = [];

  for (const pull of params.pulls) {
    const blockers = classifyOwnPullBlockers(pull, params.currentUser, params.thresholds, now);
    if (blockers.length === 0) continue;
    entries.push({ pull, blockers });
  }

  return entries.sort((a, b) => {
    if (a.blockers.length !== b.blockers.length) {
      return b.blockers.length - a.blockers.length;
    }
    return new Date(a.pull.updatedAt).getTime() - new Date(b.pull.updatedAt).getTime();
  });
}

/**
 * Filter blocker entries by kind chips.
 * Empty `activeKinds` → all entries; otherwise keep rows with any selected kind.
 */
export function filterPrBlockers(
  entries: PrBlockerEntry[],
  activeKinds: readonly PrBlockerKind[],
): PrBlockerEntry[] {
  if (activeKinds.length === 0) return entries;
  const selected = new Set(activeKinds);
  return entries.filter((e) => e.blockers.some((k) => selected.has(k)));
}

/** Detail path for a blocked PR, or null if repo is malformed. */
export function prBlockerDetailPath(pull: Pick<PullSummary, "repo" | "number">): string | null {
  const [owner, repo] = pull.repo.split("/");
  if (!owner || !repo) return null;
  return `/pulls/${owner}/${repo}/${pull.number}`;
}

export function togglePrBlockerFilter(
  active: readonly PrBlockerKind[],
  kind: PrBlockerKind,
): PrBlockerKind[] {
  return active.includes(kind) ? active.filter((k) => k !== kind) : [...active, kind];
}
