const LAST_SEEN_KEY = "pulse-digest-last-seen";
const DEFAULT_GAP_HOURS = 6;
const DEFAULT_LOOKBACK_HOURS = 24;

export function loadDigestLastSeen(
  storage: Pick<Storage, "getItem"> = localStorage,
): string | null {
  try {
    return storage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function saveDigestLastSeen(
  iso: string,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(LAST_SEEN_KEY, iso);
  } catch {
    // 保存できなければ次回also表示されるだけ
  }
}

/** 前回表示からgapHours以上経過していれば起動時ダイジェストを出す。 */
export function shouldShowDigest(
  lastSeenIso: string | null,
  now: Date,
  gapHours: number = DEFAULT_GAP_HOURS,
): boolean {
  if (!lastSeenIso) return false; // 初回起動はキャッシュが空なので出さない
  const lastSeen = new Date(lastSeenIso).getTime();
  if (Number.isNaN(lastSeen)) return true;
  return now.getTime() - lastSeen >= gapHours * 60 * 60 * 1000;
}

/** ダイジェストの集計開始時刻。前回表示時刻、なければ24時間前。 */
export function digestSince(lastSeenIso: string | null, now: Date): string {
  if (lastSeenIso && !Number.isNaN(new Date(lastSeenIso).getTime())) {
    return lastSeenIso;
  }
  return new Date(now.getTime() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
}
