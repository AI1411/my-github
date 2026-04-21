import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTimeGroup } from "./timeGroup";

describe("getTimeGroup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns Today for < 24h ago", () => {
    expect(getTimeGroup("2026-04-21T06:00:00Z")).toBe("Today");
    expect(getTimeGroup("2026-04-21T00:00:00Z")).toBe("Today");
  });

  it("returns Yesterday for 24-48h ago", () => {
    expect(getTimeGroup("2026-04-20T11:00:00Z")).toBe("Yesterday");
  });

  it("returns This Week for 48-168h ago", () => {
    expect(getTimeGroup("2026-04-18T12:00:00Z")).toBe("This Week");
    expect(getTimeGroup("2026-04-16T00:00:00Z")).toBe("This Week");
  });

  it("returns Older for > 7 days ago", () => {
    expect(getTimeGroup("2026-04-10T00:00:00Z")).toBe("Older");
  });
});
