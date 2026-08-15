import { describe, expect, it } from "vitest";
import {
  PUSH_ASSISTED_FOCUSED_POLL_SECONDS,
  effectivePollingSeconds,
  resolveSyncMode,
} from "./syncMode";

describe("syncMode", () => {
  it("resolves poll vs push-assisted from the toggle", () => {
    expect(resolveSyncMode(false)).toBe("poll");
    expect(resolveSyncMode(true)).toBe("push-assisted");
  });

  it("keeps the configured interval when push-assisted is off", () => {
    expect(effectivePollingSeconds(false, "60s", true)).toBe(60);
    expect(effectivePollingSeconds(false, "5m", true)).toBe(300);
  });

  it("caps at 30s when push-assisted and focused", () => {
    expect(effectivePollingSeconds(true, "60s", true)).toBe(
      PUSH_ASSISTED_FOCUSED_POLL_SECONDS,
    );
    expect(effectivePollingSeconds(true, "5m", true)).toBe(
      PUSH_ASSISTED_FOCUSED_POLL_SECONDS,
    );
    expect(effectivePollingSeconds(true, "30s", true)).toBe(30);
  });

  it("does not shorten the interval when unfocused", () => {
    expect(effectivePollingSeconds(true, "60s", false)).toBe(60);
    expect(effectivePollingSeconds(true, "5m", false)).toBe(300);
  });

  it("returns 0 when polling is off", () => {
    expect(effectivePollingSeconds(true, "off", true)).toBe(0);
    expect(effectivePollingSeconds(false, "off", false)).toBe(0);
  });
});
