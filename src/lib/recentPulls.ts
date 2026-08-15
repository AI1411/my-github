/** Max recent PR entries kept per account. */
export const RECENT_PULLS_MAX = 20;

export interface RecentPullRef {
  repo: string;
  number: number;
  title: string;
  /** ISO timestamp when the PR detail was last opened. */
  openedAt: string;
}

/**
 * Prepend `entry` to the recent list, deduping by repo+number and capping at `max`.
 */
export function pushRecent(
  list: RecentPullRef[],
  entry: RecentPullRef,
  max: number = RECENT_PULLS_MAX,
): RecentPullRef[] {
  if (!entry.repo || !Number.isFinite(entry.number)) return list;
  const filtered = list.filter(
    (item) => !(item.repo === entry.repo && item.number === entry.number),
  );
  return [entry, ...filtered].slice(0, Math.max(0, max));
}
