import type { InboxItem } from "../stores/dataStore";

export const INBOX_QUEUE_KEY = "pulse-inbox-queue";

export interface InboxQueueEntry {
  id: string;
  path: string;
}

export interface InboxQueueState {
  entries: InboxQueueEntry[];
  index: number;
}

function isPullUrl(htmlUrl: string | null): boolean {
  return typeof htmlUrl === "string" && htmlUrl.includes("/pull");
}

function isIssueUrl(htmlUrl: string | null): boolean {
  return typeof htmlUrl === "string" && htmlUrl.includes("/issues/");
}

/** In-app detail path for an inbox item, or null when repo/number cannot be parsed. */
export function inboxItemDetailPath(
  item: Pick<InboxItem, "kind" | "repo" | "number" | "htmlUrl">,
): string | null {
  if (item.number === null) return null;
  const [owner, repo] = item.repo.split("/");
  if (!owner || !repo) return null;
  const section =
    isIssueUrl(item.htmlUrl) && !isPullUrl(item.htmlUrl)
      ? "issues"
      : item.kind === "mention" && !isPullUrl(item.htmlUrl)
        ? "issues"
        : "pulls";
  return `/${section}/${owner}/${repo}/${item.number}`;
}

export function buildInboxQueue(items: InboxItem[]): InboxQueueEntry[] {
  const entries: InboxQueueEntry[] = [];
  for (const item of items) {
    const path = inboxItemDetailPath(item);
    if (!path) continue;
    entries.push({ id: item.id, path });
  }
  return entries;
}

export function saveInboxQueue(
  entries: InboxQueueEntry[],
  currentId: string,
  storage: Pick<Storage, "setItem"> = sessionStorage,
): void {
  const index = Math.max(
    0,
    entries.findIndex((entry) => entry.id === currentId),
  );
  try {
    storage.setItem(INBOX_QUEUE_KEY, JSON.stringify({ entries, index } satisfies InboxQueueState));
  } catch {
    // sessionStorage が使えなければ次件遷移が無効になるだけ
  }
}

export function loadInboxQueue(
  storage: Pick<Storage, "getItem"> = sessionStorage,
): InboxQueueState | null {
  try {
    const raw = storage.getItem(INBOX_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxQueueState;
    if (!Array.isArray(parsed.entries) || typeof parsed.index !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearInboxQueue(storage: Pick<Storage, "removeItem"> = sessionStorage): void {
  try {
    storage.removeItem(INBOX_QUEUE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Advance past the current queue item.
 * Returns the next detail path, or null when the queue is exhausted.
 */
export function advanceInboxQueue(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = sessionStorage,
): string | null {
  const state = loadInboxQueue(storage);
  if (!state || state.entries.length === 0) {
    clearInboxQueue(storage);
    return null;
  }
  const nextIndex = state.index + 1;
  if (nextIndex >= state.entries.length) {
    clearInboxQueue(storage);
    return null;
  }
  saveInboxQueue(state.entries, state.entries[nextIndex].id, storage);
  return state.entries[nextIndex].path;
}
