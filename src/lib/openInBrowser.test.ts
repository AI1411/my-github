import { beforeEach, describe, expect, it, vi } from "vitest";
import { openInBrowser } from "./openInBrowser";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("openInBrowser", () => {
  beforeEach(async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    vi.mocked(openUrl).mockClear();
  });
  it("opens the URL via the opener plugin", async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openInBrowser("https://github.com/octocat/hello/pull/5");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/octocat/hello/pull/5");
  });

  it("does nothing when the URL is missing", async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openInBrowser(null);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
