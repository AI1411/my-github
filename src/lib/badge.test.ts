import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUnreadBadge } from "./badge";

const windowApi = vi.hoisted(() => ({
  setBadgeCount: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: windowApi.getCurrentWindow,
}));

describe("updateUnreadBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowApi.getCurrentWindow.mockReturnValue({
      setBadgeCount: windowApi.setBadgeCount,
    });
    windowApi.setBadgeCount.mockResolvedValue(undefined);
  });

  it("sets unread count when enabled", async () => {
    await updateUnreadBadge(7, true);

    expect(windowApi.setBadgeCount).toHaveBeenCalledWith(7);
  });

  it("clears the badge when disabled", async () => {
    await updateUnreadBadge(7, false);

    expect(windowApi.setBadgeCount).toHaveBeenCalledWith(undefined);
  });

  it("clears the badge for zero unread items", async () => {
    await updateUnreadBadge(0, true);

    expect(windowApi.setBadgeCount).toHaveBeenCalledWith(undefined);
  });

  it("ignores unsupported platform failures", async () => {
    windowApi.setBadgeCount.mockRejectedValue(new Error("unsupported"));

    await expect(updateUnreadBadge(7, true)).resolves.toBeUndefined();
  });
});
