import type { InboxData, InboxItem, PullSummary } from "../stores/dataStore";

export interface StaleThresholds {
  /** レビュー要求がこの日数以上更新されていなければ「自分がブロック中」とみなす */
  reviewRequestDays: number;
  /** 自分のopen PRがこの日数以上更新されていなければ「放置されている」とみなす */
  myPullDays: number;
}

export const DEFAULT_STALE_THRESHOLDS: StaleThresholds = {
  reviewRequestDays: 3,
  myPullDays: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(updatedAt: string, now: Date): number {
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return 0;
  return (now.getTime() - updated) / DAY_MS;
}

/**
 * Inboxのレビュー要求と自分のopen PRから滞留項目を抽出する。
 * 返る項目のIDは元項目と衝突しないよう "stale-" プレフィックスを持つ。
 * 古いものほど先頭に並ぶ。
 */
export function findStaleItems(params: {
  inbox: Pick<InboxData, "reviewRequests"> | null;
  pulls: PullSummary[];
  currentUser: string | null;
  thresholds: StaleThresholds;
  now: Date;
}): InboxItem[] {
  const { inbox, pulls, currentUser, thresholds, now } = params;
  const out: InboxItem[] = [];

  for (const item of inbox?.reviewRequests ?? []) {
    if (ageInDays(item.updatedAt, now) >= thresholds.reviewRequestDays) {
      out.push({
        ...item,
        id: `stale-${item.id}`,
        kind: "stale_review_request",
      });
    }
  }

  if (currentUser) {
    for (const pull of pulls) {
      if (pull.state !== "open" || pull.isDraft) continue;
      if (pull.author !== currentUser) continue;
      if (pull.mergedAt !== null) continue;
      if (pull.reviewState === "approved") continue;
      if (ageInDays(pull.updatedAt, now) < thresholds.myPullDays) continue;
      out.push({
        id: `stale-own-${pull.repo}-${pull.number}`,
        kind: "stale_own_pull",
        repo: pull.repo,
        number: pull.number,
        title: pull.title,
        htmlUrl: pull.htmlUrl,
        updatedAt: pull.updatedAt,
        unread: false,
        pinned: false,
      });
    }
  }

  return out.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export function staleItemDescription(kind: string): string {
  if (kind === "stale_review_request") return "Waiting on your review";
  if (kind === "stale_own_pull") return "Your PR has had no activity";
  return "";
}
