/** Unique label names across pull summaries, sorted. */
export function uniquePullLabels(pulls: Array<{ labels?: string[] }>): string[] {
  return Array.from(new Set(pulls.flatMap((pull) => pull.labels ?? []))).sort();
}

/** True when the pull has every selected label (empty selection matches all). */
export function pullMatchesLabels(
  pull: { labels?: string[] },
  selected: string[] | undefined,
): boolean {
  if (!selected || selected.length === 0) return true;
  const names = pull.labels ?? [];
  return selected.every((label) => names.includes(label));
}
