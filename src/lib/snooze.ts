export type SnoozeOption = "1h" | "tomorrow" | "nextWeek";

export const SNOOZE_OPTIONS: { id: SnoozeOption; label: string }[] = [
  { id: "1h", label: "1 hour" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "nextWeek", label: "Next week" },
];

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
