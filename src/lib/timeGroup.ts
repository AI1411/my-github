export type TimeGroup = "Today" | "Yesterday" | "This Week" | "Older";

export function getTimeGroup(updatedAt: string): TimeGroup {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const hours = diffMs / 3_600_000;
  if (hours < 24) return "Today";
  if (hours < 48) return "Yesterday";
  if (hours < 168) return "This Week";
  return "Older";
}
