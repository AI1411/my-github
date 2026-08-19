import { invoke } from "@tauri-apps/api/core";

type PrefetchKind = "pull" | "issue";

const cache = new Map<string, Promise<unknown>>();

function key(kind: PrefetchKind, owner: string, repo: string, number: number): string {
  return `${kind}:${owner}/${repo}#${number}`;
}

export function prefetchPullDetail(owner: string, repo: string, number: number): void {
  const k = key("pull", owner, repo, number);
  if (cache.has(k)) return;
  const promise = invoke("cmd_get_pull_files", { owner, repo, number }).catch(() => {
    cache.delete(k);
  });
  cache.set(k, promise);
}

export function prefetchIssueDetail(owner: string, repo: string, number: number): void {
  const k = key("issue", owner, repo, number);
  if (cache.has(k)) return;
  const promise = invoke("cmd_get_issue", { owner, repo, number }).catch(() => {
    cache.delete(k);
  });
  cache.set(k, promise);
}

/** Test helper */
export function clearPrefetchCache(): void {
  cache.clear();
}

export function getPrefetchPromise<T>(
  kind: PrefetchKind,
  owner: string,
  repo: string,
  number: number,
): Promise<T> | undefined {
  const cached = cache.get(key(kind, owner, repo, number));
  return cached as Promise<T> | undefined;
}

export function hasPrefetch(
  kind: PrefetchKind,
  owner: string,
  repo: string,
  number: number,
): boolean {
  return cache.has(key(kind, owner, repo, number));
}
