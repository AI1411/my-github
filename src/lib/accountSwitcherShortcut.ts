/** Max accounts reachable via ⌘1–⌘4 (1-based digits). */
export const ACCOUNT_SWITCH_DIGIT_MAX = 4;

/**
 * Maps a keyboard digit key ("1"…"4") to a 0-based account list index.
 * Returns null when the key is outside the switcher range.
 */
export function accountIndexFromDigitKey(key: string): number | null {
  if (key.length !== 1) return null;
  const digit = Number(key);
  if (!Number.isInteger(digit) || digit < 1 || digit > ACCOUNT_SWITCH_DIGIT_MAX) {
    return null;
  }
  return digit - 1;
}

/**
 * Resolves the account at a shortcut index (0–3).
 * Out-of-range indexes or missing slots return undefined (no-op).
 */
export function resolveAccountSwitchTarget<T>(
  accounts: readonly T[],
  index: number,
): T | undefined {
  if (index < 0 || index >= ACCOUNT_SWITCH_DIGIT_MAX) return undefined;
  return accounts[index];
}

/** Display label for the nth account shortcut (⌘1…⌘4). */
export function accountSwitchShortcutLabel(index: number): string | null {
  if (index < 0 || index >= ACCOUNT_SWITCH_DIGIT_MAX) return null;
  return `⌘${index + 1}`;
}
