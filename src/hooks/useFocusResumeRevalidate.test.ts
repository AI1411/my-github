import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useFocusResumeRevalidate } from "./useFocusResumeRevalidate";
import { useUiStore } from "../stores/uiStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useFocusResumeRevalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ rateLimitHit: null });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("triggers cmd_sync_now when the window becomes visible", () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderHook(() => useFocusResumeRevalidate());
    document.dispatchEvent(new Event("visibilitychange"));
    expect(invoke).toHaveBeenCalledWith("cmd_sync_now");
  });

  it("skips sync while rate-limited", () => {
    useUiStore.setState({
      rateLimitHit: { remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 },
    });
    renderHook(() => useFocusResumeRevalidate());
    document.dispatchEvent(new Event("visibilitychange"));
    expect(invoke).not.toHaveBeenCalled();
  });
});
