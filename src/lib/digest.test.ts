import { beforeEach, describe, expect, it } from "vitest";
import { digestSince, loadDigestLastSeen, saveDigestLastSeen, shouldShowDigest } from "./digest";

const now = new Date("2026-07-16T12:00:00Z");

describe("shouldShowDigest", () => {
  it("does not show on first launch (no stored timestamp)", () => {
    expect(shouldShowDigest(null, now)).toBe(false);
  });

  it("shows after the gap has passed", () => {
    expect(shouldShowDigest("2026-07-16T00:00:00Z", now)).toBe(true);
  });

  it("does not show within the gap", () => {
    expect(shouldShowDigest("2026-07-16T10:00:00Z", now)).toBe(false);
  });

  it("shows for a corrupt stored timestamp", () => {
    expect(shouldShowDigest("garbage", now)).toBe(true);
  });
});

describe("digestSince", () => {
  it("uses the stored timestamp when valid", () => {
    expect(digestSince("2026-07-16T00:00:00Z", now)).toBe("2026-07-16T00:00:00Z");
  });

  it("falls back to 24 hours ago", () => {
    expect(digestSince(null, now)).toBe("2026-07-15T12:00:00.000Z");
    expect(digestSince("garbage", now)).toBe("2026-07-15T12:00:00.000Z");
  });
});

describe("digest last-seen storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the timestamp", () => {
    expect(loadDigestLastSeen()).toBeNull();
    saveDigestLastSeen("2026-07-16T12:00:00Z");
    expect(loadDigestLastSeen()).toBe("2026-07-16T12:00:00Z");
  });
});
