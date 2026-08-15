/** Build GitHub code search `q` scoped to a repo (`terms repo:owner/name`). */
export function buildCodeSearchQuery(query: string, repo: string): string | null {
  const q = query.trim();
  const r = repo.trim();
  if (!q || !r) return null;
  return `${q} repo:${r}`;
}

/** Open a file on GitHub at HEAD for the given owner/name + path. */
export function buildFileJumpUrl(repo: string, path: string): string | null {
  const r = repo.trim();
  const p = path.trim().replace(/^\/+/, "");
  if (!r || !p) return null;
  return `https://github.com/${r}/blob/HEAD/${p}`;
}
