import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUnreadBadge } from "../../lib/badge";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { Sidebar } from "./Sidebar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../lib/badge", () => ({
  updateUnreadBadge: vi.fn().mockResolvedValue(undefined),
}));

describe("Sidebar badge integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: null,
      status: "authenticated",
    });
    useUiStore.setState({ workspaceSwitcherOpen: false });
    useSettingsStore.setState({
      watchedRepositories: [],
      notificationSettings: {
        enabled: true,
        ciFailures: "immediate",
        reviewRequests: "immediate",
        mentions: "immediate",
      },
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
      pinnedPullsByAccount: {},
    });
    useDataStore.setState({
      pulls: [],
      issues: [],
      notifications: [
        {
          id: "unread",
          reason: "mention",
          repo: "o/r",
          subjectTitle: "Unread",
          subjectType: "Issue",
          htmlUrl: null,
          unread: true,
          updatedAt: "2026-04-29T00:00:00Z",
        },
        {
          id: "read",
          reason: "mention",
          repo: "o/r",
          subjectTitle: "Read",
          subjectType: "Issue",
          htmlUrl: null,
          unread: false,
          updatedAt: "2026-04-29T00:00:00Z",
        },
      ],
      lastSyncedAt: null,
    });
  });

  it("updates the app badge with unread notification count", async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(updateUnreadBadge).toHaveBeenCalledWith(1, true);
    });
  });

  it("shows the my-github app name", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("my-github")).toBeInTheDocument();
  });

  it("lists saved filters in the sidebar", () => {
    useSettingsStore.setState({
      savedFilters: [
        { id: "v1", name: "My reviews", target: "pulls", query: "tab=review" },
      ],
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Views")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My reviews" })).toHaveAttribute(
      "href",
      "/pulls?tab=review",
    );
  });

  it("lists pinned pulls with live CI/review status", () => {
    useSettingsStore.setState({
      pinnedPullsByAccount: {
        octocat: [{ repo: "o/r", number: 7 }],
      },
    });
    useDataStore.setState({
      pulls: [
        {
          id: 7,
          number: 7,
          title: "Watch me",
          repo: "o/r",
          author: "octocat",
          state: "open",
          isDraft: false,
          headRef: "feat",
          baseRef: "main",
          updatedAt: "2026-04-29T00:00:00Z",
          htmlUrl: null,
          ciState: "failure",
          reviewState: null,
          hasMention: false,
          requestedReviewers: [],
          mergedAt: null,
          additions: 1,
          deletions: 0,
          changedFiles: 1,
        },
      ],
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch me/ })).toHaveAttribute("href", "/pulls/o/r/7");
    expect(screen.getByLabelText("CI failing")).toBeInTheDocument();
  });
});
