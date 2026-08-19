import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/authStore";
import { useInboxQuery } from "./useInboxQuery";
import type { InboxData } from "../../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const emptyInbox = { reviewRequests: [], ciFailures: [], mentions: [] };

describe("useInboxQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
  });

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

  it("marks auth expired on 401 without treating network errors as expired", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
      "GitHub API error (HTTP 401): Bad credentials",
    );
    renderHook(() => useInboxQuery());
    await waitFor(() => expect(useAuthStore.getState().status).toBe("expired"));

    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("network error");
    const { result } = renderHook(() => useInboxQuery());
    await waitFor(() => expect(result.current.error).toBe("network error"));
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("ignores stale responses when a newer refetch wins", async () => {
    let resolveFirst!: (value: InboxData) => void;
    const first = new Promise<InboxData>((resolve) => {
      resolveFirst = resolve;
    });
    const second = {
      reviewRequests: [
        {
          id: "2",
          kind: "review_requested",
          repo: "o/r",
          number: null,
          title: "Latest",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
      ciFailures: [],
      mentions: [],
    };

    (invoke as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(second)
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useInboxQuery());
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.reviewRequests[0]?.title).toBe("Latest");
    });

    resolveFirst({
      reviewRequests: [
        {
          id: "1",
          kind: "review_requested",
          repo: "o/r",
          number: null,
          title: "Stale",
          htmlUrl: null,
          updatedAt: "2026-04-21T00:00:00Z",
          unread: true,
          pinned: false,
        },
      ],
      ciFailures: [],
      mentions: [],
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.data?.reviewRequests[0]?.title).toBe("Latest");
  });
});
