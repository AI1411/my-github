import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../stores/uiStore";
import { useOnlineStatus } from "./useOnlineStatus";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("useOnlineStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ offline: false });
    setNavigatorOnline(true);
  });

  it("sets offline immediately when navigator is offline", async () => {
    setNavigatorOnline(false);

    renderHook(() => useOnlineStatus());

    await waitFor(() => expect(useUiStore.getState().offline).toBe(true));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses cmd_ping to confirm online state", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    renderHook(() => useOnlineStatus());

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_ping");
    });
    expect(useUiStore.getState().offline).toBe(false);
  });

  it("marks offline when ping fails after an online event", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    renderHook(() => useOnlineStatus());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(useUiStore.getState().offline).toBe(true));
  });
});
