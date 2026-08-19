import { readAppStorage, writeAppStorage } from "./appStorageKeys";
export type SnoozeOption = "1h" | "tomorrow" | "nextWeek";

export const SNOOZE_OPTIONS: { id: SnoozeOption; label: string }[] = [
  { id: "1h", label: "1 hour" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "nextWeek", label: "Next week" },
];

const LAST_SNOOZE_SUFFIX = "inbox-last-snooze";

const VALID_OPTIONS = new Set<SnoozeOption>(SNOOZE_OPTIONS.map((o) => o.id));

/**
 * Returns the snooze deadline as epoch seconds.
 * "tomorrow" / "nextWeek" resolve to 9:00 local time on the target day.
 */
export function snoozeUntilEpochSecs(option: SnoozeOption, now: Date): number {
  if (option === "1h") {
    return Math.floor(now.getTime() / 1000) + 3600;
  }
  const target = new Date(now);
  target.setDate(target.getDate() + (option === "tomorrow" ? 1 : 7));
  target.setHours(9, 0, 0, 0);
  return Math.floor(target.getTime() / 1000);
}

export function loadLastSnoozeOption(
  storage: Pick<Storage, "getItem"> = localStorage,
): SnoozeOption | null {
  try {
    const raw = readAppStorage(storage, LAST_SNOOZE_SUFFIX);
    if (raw && VALID_OPTIONS.has(raw as SnoozeOption)) {
      return raw as SnoozeOption;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLastSnoozeOption(
  option: SnoozeOption,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    writeAppStorage(storage, LAST_SNOOZE_SUFFIX, option);
  } catch {
    // 保存失敗時は次回 ⇧H が picker にフォールバックするだけ
  }
}
