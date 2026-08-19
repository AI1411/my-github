import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useDataStore } from "../../stores/dataStore";
import { SyncStatusBar } from "./SyncStatusBar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("SyncStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataStore.setState({ lastSyncedAt: null });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastRateLimit: { remaining: 4321, reset: 1770000000 },
    });
  });

  it("shows Never synced until a sync has completed", async () => {
    render(<SyncStatusBar />);
    expect(screen.getByTestId("sync-status-bar")).toHaveTextContent("Never synced");
    expect(screen.getByTestId("sync-status-bar")).toHaveAttribute(
      "title",
      expect.stringContaining("repositories"),
    );
    await waitFor(() => {
      expect(screen.getByTestId("sync-status-bar")).toHaveTextContent("4321 remaining");
    });
  });

  it("shows last synced relative time", async () => {
    useDataStore.setState({ lastSyncedAt: new Date().toISOString() });
    render(<SyncStatusBar />);
    expect(screen.getByTestId("sync-status-bar")).toHaveTextContent("Last synced just now");
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_sync_status");
    });
  });
});
