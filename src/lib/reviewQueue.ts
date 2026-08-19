import type { InboxItem, PullSummary } from "../stores/dataStore";
import { isBotLogin } from "./botAuthors";
import type { StaleThresholds } from "./stalePulls";

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(updatedAt: string, now: Date): number {
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return 0;
  return (now.getTime() - updated) / DAY_MS;
}

/** Whether a review-request inbox item is stale by reviewRequestDays. */
export function isReviewRequestStale(
  item: Pick<InboxItem, "updatedAt">,
  thresholds: StaleThresholds,
  now: Date = new Date(),
): boolean {
  return ageInDays(item.updatedAt, now) >= thresholds.reviewRequestDays;
}

function isCiFailing(ciState: string | null | undefined): boolean {
  return ciState === "failure" || ciState === "error";
}

function findMatchingPull(item: InboxItem, pulls: PullSummary[]): PullSummary | undefined {
  if (item.number === null) return undefined;
  return pulls.find((p) => p.repo === item.repo && p.number === item.number);
}

/** Whether a review-request inbox item was opened by a bot author. */
export function isBotReviewRequest(item: InboxItem, pulls: PullSummary[]): boolean {
  const author = findMatchingPull(item, pulls)?.author;
  return author != null && isBotLogin(author);
}

export interface ReviewQueueEntry {
  item: InboxItem;
  ciFailing: boolean;
  stale: boolean;
  ciState: string | null;
}

/**
 * Build a priority queue from review-requested inbox items.
 * Sort: CI failure first, then stale (older updatedAt first), then others.
 */
export function buildReviewQueue(params: {
  reviewRequests: InboxItem[];
  pulls: PullSummary[];
  thresholds: StaleThresholds;
  hideBotReviewRequests?: boolean;
  now?: Date;
}): ReviewQueueEntry[] {
  const now = params.now ?? new Date();
  const reviewRequests =
    params.hideBotReviewRequests === false
      ? params.reviewRequests
      : params.reviewRequests.filter((item) => !isBotReviewRequest(item, params.pulls));
  const entries: ReviewQueueEntry[] = reviewRequests.map((item) => {
    const pull = findMatchingPull(item, params.pulls);
    const ciState = pull?.ciState ?? null;
    return {
      item,
      ciFailing: isCiFailing(ciState),
      stale: isReviewRequestStale(item, params.thresholds, now),
      ciState,
    };
  });

  return entries.sort((a, b) => {
    if (a.ciFailing !== b.ciFailing) return a.ciFailing ? -1 : 1;
    if (a.stale !== b.stale) return a.stale ? -1 : 1;
    return new Date(a.item.updatedAt).getTime() - new Date(b.item.updatedAt).getTime();
  });
}

/** Advance to the next index, wrapping to 0. No-op when length is 0. */
export function nextReviewQueueIndex(currentIndex: number, length: number): number {
  if (length <= 0) return 0;
  return (currentIndex + 1) % length;
}

/** Detail path for a queue entry, or null if repo/number missing. */
export function reviewQueueDetailPath(item: InboxItem): string | null {
  if (item.number === null) return null;
  const [owner, repo] = item.repo.split("/");
  if (!owner || !repo) return null;
  return `/pulls/${owner}/${repo}/${item.number}`;
}
