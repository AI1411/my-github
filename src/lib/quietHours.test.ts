import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_HOURS,
  isInQuietHours,
  normalizeQuietHours,
  parseTimeToMinutes,
} from "./quietHours";

describe("parseTimeToMinutes", () => {
  it("parses HH:MM and optional seconds", () => {
    expect(parseTimeToMinutes("22:00")).toBe(22 * 60);
    expect(parseTimeToMinutes("08:30")).toBe(8 * 60 + 30);
    expect(parseTimeToMinutes("8:05")).toBe(8 * 60 + 5);
    expect(parseTimeToMinutes("22:00:00")).toBe(22 * 60);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("nope")).toBeNull();
  });
});

describe("normalizeQuietHours", () => {
  it("falls back to defaults for invalid payloads", () => {
    expect(normalizeQuietHours(null)).toEqual(DEFAULT_QUIET_HOURS);
    expect(normalizeQuietHours({ enabled: "yes", start: "99:99" })).toEqual({
      ...DEFAULT_QUIET_HOURS,
      enabled: false,
    });
  });

  it("keeps a valid overnight window", () => {
    expect(normalizeQuietHours({ enabled: true, start: "22:00:00", end: "08:00" })).toEqual({
      enabled: true,
      start: "22:00",
      end: "08:00",
    });
  });
});

describe("isInQuietHours", () => {
  const overnight = { enabled: true, start: "22:00", end: "08:00" };
  const daytime = { enabled: true, start: "09:00", end: "17:00" };

  it("is inactive when disabled", () => {
    expect(isInQuietHours(new Date("2026-08-15T23:00:00"), { ...overnight, enabled: false })).toBe(
      false,
    );
  });

  it("covers an overnight window", () => {
    expect(isInQuietHours(new Date("2026-08-15T22:00:00"), overnight)).toBe(true);
    expect(isInQuietHours(new Date("2026-08-15T23:30:00"), overnight)).toBe(true);
    expect(isInQuietHours(new Date("2026-08-15T07:59:00"), overnight)).toBe(true);
    expect(isInQuietHours(new Date("2026-08-15T08:00:00"), overnight)).toBe(false);
    expect(isInQuietHours(new Date("2026-08-15T12:00:00"), overnight)).toBe(false);
    expect(isInQuietHours(new Date("2026-08-15T21:59:00"), overnight)).toBe(false);
  });

  it("covers a same-day window", () => {
    expect(isInQuietHours(new Date("2026-08-15T09:00:00"), daytime)).toBe(true);
    expect(isInQuietHours(new Date("2026-08-15T16:59:00"), daytime)).toBe(true);
    expect(isInQuietHours(new Date("2026-08-15T17:00:00"), daytime)).toBe(false);
    expect(isInQuietHours(new Date("2026-08-15T08:59:00"), daytime)).toBe(false);
  });
});
