import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/authStore";
import { useCrossAccountInboxQuery } from "./useCrossAccountInboxQuery";
import type { CrossAccountInboxItem } from "../../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const sampleItem: CrossAccountInboxItem = {
  id: "1",
  kind: "review_requested",
  repo: "o/r",
  number: 5,
  title: "Review me",
  htmlUrl: "https://github.com/o/r/pull/5",
  updatedAt: "2026-04-21T00:00:00Z",
  unread: true,
  pinned: false,
  accountLogin: "bob",
  accountAvatarUrl: null,
  isActiveAccount: false,
};

describe("useCrossAccountInboxQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
  });

  it("does not fetch when disabled", () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { result } = renderHook(() => useCrossAccountInboxQuery(false));
    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("calls cmd_get_cross_account_inbox when enabled", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([sampleItem]);
    const { result } = renderHook(() => useCrossAccountInboxQuery(true));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_cross_account_inbox");
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].accountLogin).toBe("bob");
  });

  it("clears items and refetches when toggled from disabled to enabled", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([sampleItem]);
    const { result, rerender } = renderHook(
      ({ enabled }) => useCrossAccountInboxQuery(enabled),
      { initialProps: { enabled: false } },
    );
    expect(result.current.items).toEqual([]);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it("captures errors", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("network error");
    const { result } = renderHook(() => useCrossAccountInboxQuery(true));
    await waitFor(() => expect(result.current.error).toBe("network error"));
    expect(result.current.items).toEqual([]);
  });
});
