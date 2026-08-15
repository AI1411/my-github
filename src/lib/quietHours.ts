export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: "22:00",
  end: "08:00",
};

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function normalizeQuietHours(raw: unknown): QuietHours {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_QUIET_HOURS };
  const source = raw as Record<string, unknown>;
  const start =
    typeof source.start === "string" && parseTimeToMinutes(source.start) != null
      ? source.start.slice(0, 5)
      : DEFAULT_QUIET_HOURS.start;
  const end =
    typeof source.end === "string" && parseTimeToMinutes(source.end) != null
      ? source.end.slice(0, 5)
      : DEFAULT_QUIET_HOURS.end;
  return {
    enabled: source.enabled === true,
    start,
    end,
  };
}

export function isInQuietHours(now: Date, hours: QuietHours): boolean {
  if (!hours.enabled) return false;
  const start = parseTimeToMinutes(hours.start);
  const end = parseTimeToMinutes(hours.end);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}
