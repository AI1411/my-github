import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useInboxQuery } from "./useInboxQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const emptyInbox = { reviewRequests: [], ciFailures: [], mentions: [] };

describe("useInboxQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls cmd_get_inbox on mount", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(emptyInbox);
    renderHook(() => useInboxQuery());
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_inbox");
    });
  });

  it("returns inbox data when successful", async () => {
    const data = {
      reviewRequests: [
        {
          id: "1",
          kind: "review_requested",
          repo: "o/r",
          number: null,
          title: "Review me",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
      ciFailures: [],
      mentions: [],
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(data);
    const { result } = renderHook(() => useInboxQuery());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data!.reviewRequests).toHaveLength(1);
  });

  it("captures errors", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("network error");
    const { result } = renderHook(() => useInboxQuery());
    await waitFor(() => expect(result.current.error).toBe("network error"));
  });
});
