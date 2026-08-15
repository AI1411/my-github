/** Clamp a file-list cursor after moving by delta. */
export function stepFileIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, current + delta));
}
