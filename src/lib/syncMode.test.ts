import { describe, expect, it } from "vitest";
import {
  PUSH_ASSISTED_FOCUSED_POLL_SECONDS,
  UNFOCUSED_POLL_SECONDS,
  effectivePollingSeconds,
  isWindowFocused,
  resolveSyncMode,
} from "./syncMode";

describe("syncMode", () => {
  it("resolves poll vs push-assisted from the toggle", () => {
    expect(resolveSyncMode(false)).toBe("poll");
    expect(resolveSyncMode(true)).toBe("push-assisted");
  });

  it("keeps the configured interval when push-assisted is off and focused", () => {
    expect(effectivePollingSeconds(false, "60s", true)).toBe(60);
    expect(effectivePollingSeconds(false, "5m", true)).toBe(300);
  });

  it("caps at 30s when push-assisted and focused", () => {
    expect(effectivePollingSeconds(true, "60s", true)).toBe(PUSH_ASSISTED_FOCUSED_POLL_SECONDS);
    expect(effectivePollingSeconds(true, "5m", true)).toBe(PUSH_ASSISTED_FOCUSED_POLL_SECONDS);
    expect(effectivePollingSeconds(true, "30s", true)).toBe(30);
  });

  it("slows to 5 minutes when unfocused regardless of settings", () => {
    expect(effectivePollingSeconds(true, "60s", false)).toBe(UNFOCUSED_POLL_SECONDS);
    expect(effectivePollingSeconds(true, "5m", false)).toBe(UNFOCUSED_POLL_SECONDS);
    expect(effectivePollingSeconds(false, "30s", false)).toBe(UNFOCUSED_POLL_SECONDS);
  });

  it("returns 0 when polling is off", () => {
    expect(effectivePollingSeconds(true, "off", true)).toBe(0);
    expect(effectivePollingSeconds(false, "off", false)).toBe(0);
  });

  it("treats hidden documents as unfocused", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => true,
    });
    expect(isWindowFocused()).toBe(false);
  });

  it("treats visible but blurred windows as unfocused", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => false,
    });
    expect(isWindowFocused()).toBe(false);
  });

  it("treats visible focused windows as focused", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => true,
    });
    expect(isWindowFocused()).toBe(true);
  });
});
