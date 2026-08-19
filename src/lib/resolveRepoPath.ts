import { invoke } from "@tauri-apps/api/core";

function parseFullName(fullName: string): { owner: string; repo: string } | null {
  const trimmed = fullName.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  const owner = trimmed.slice(0, slash).trim();
  const repo = trimmed.slice(slash + 1).trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

function joinRootAndSegments(root: string, ...segments: string[]): string {
  const base = root.trim().replace(/[/\\]+$/, "");
  if (!base) return "";
  return [base, ...segments].join("/");
}

/** Pure path candidates for owner/repo under configured clone roots (no existence check). */
export function repoPathCandidates(roots: string[], fullName: string): string[] {
  const parsed = parseFullName(fullName);
  if (!parsed) return [];
  const { owner, repo } = parsed;
  const candidates: string[] = [];
  for (const root of roots) {
    const flat = joinRootAndSegments(root, repo);
    if (flat) candidates.push(flat);
    const nested = joinRootAndSegments(root, owner, repo);
    if (nested && nested !== flat) candidates.push(nested);
  }
  return candidates;
}

/**
 * Resolve a local clone path under configured roots via Tauri (checks for `.git`).
 * Returns null when fullName is invalid or no clone is found.
 */
export async function resolveRepoUnderRoots(
  roots: string[],
  fullName: string,
): Promise<string | null> {
  if (repoPathCandidates(roots, fullName).length === 0) return null;
  return invoke<string | null>("cmd_resolve_repo_path", { roots, fullName });
}
