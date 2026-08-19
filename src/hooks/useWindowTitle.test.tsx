import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { formatWindowTitle, useWindowTitle } from "./useWindowTitle";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("formatWindowTitle", () => {
  it("prefixes the actionable Inbox count", () => {
    expect(formatWindowTitle(0)).toBe("my-github");
    expect(formatWindowTitle(3)).toBe("(3) my-github");
  });
});

describe("useWindowTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "my-github";
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
  });

  it("sets the window title from the active account attention total", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        login: "octocat",
        avatarUrl: null,
        isActive: true,
        reviewRequests: 2,
        ciFailures: 1,
        mentions: 0,
      },
      {
        login: "work",
        avatarUrl: null,
        isActive: false,
        reviewRequests: 9,
        ciFailures: 0,
        mentions: 0,
      },
    ]);

    renderHook(() => useWindowTitle());

    await waitFor(() => expect(document.title).toBe("(3) my-github"));
    expect(invoke).toHaveBeenCalledWith("cmd_get_account_attention_summaries");
  });

  it("uses the plain app name when there is no actionable count", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        login: "octocat",
        avatarUrl: null,
        isActive: true,
        reviewRequests: 0,
        ciFailures: 0,
        mentions: 0,
      },
    ]);

    renderHook(() => useWindowTitle());

    await waitFor(() => expect(document.title).toBe("my-github"));
  });
});
