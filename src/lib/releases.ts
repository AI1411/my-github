import type { NotificationSummary, ReleaseSummary } from "../stores/dataStore";

const SEEN_KEY = "pulse-seen-release-ids";

/** ActivityRow で表示できるよう Release を通知形式へ写像する。 */
export function releaseToNotification(release: ReleaseSummary): NotificationSummary {
  const label = release.name && release.name !== release.tagName ? ` — ${release.name}` : "";
  return {
    id: `release-${release.id}`,
    reason: "release",
    repo: release.repo,
    subjectTitle: `${release.tagName}${label}`,
    subjectType: "Release",
    htmlUrl: release.htmlUrl,
    unread: false,
    updatedAt: release.publishedAt ?? "",
  };
}

/** 既知IDに含まれない新規リリースを返す。 */
export function findNewReleases(
  releases: ReleaseSummary[],
  seenIds: ReadonlySet<number>,
): ReleaseSummary[] {
  return releases.filter((release) => !seenIds.has(release.id));
}

export function loadSeenReleaseIds(storage: Pick<Storage, "getItem"> = localStorage): Set<number> {
  try {
    const raw = storage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is number => typeof v === "number"));
  } catch {
    return new Set();
  }
}

export function saveSeenReleaseIds(
  ids: ReadonlySet<number>,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // ストレージ不可時は次回起動時に全件を既知扱いにするだけ
  }
}

export function hasSeenReleases(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  try {
    return storage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
}
