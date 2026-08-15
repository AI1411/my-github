/** Returns the id that should be focused after removing `removedId` from the list. */
export function focusAfterRemoval(idsBefore: string[], removedId: string): string | null {
  const idx = idsBefore.indexOf(removedId);
  const remaining = idsBefore.filter((id) => id !== removedId);
  if (remaining.length === 0) return null;
  if (idx < 0) return remaining[0];
  if (idx < remaining.length) return remaining[idx];
  return remaining[remaining.length - 1];
}
