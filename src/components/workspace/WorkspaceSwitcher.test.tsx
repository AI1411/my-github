import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useUiStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ workspaceSwitcherOpen: false });
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: null,
      status: "authenticated",
    });
    useDataStore.getState().reset();
  });

  it("renders Accounts header when open", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("renders the current user login", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("shows Active badge for current user", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Sign out button", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("passes current account id to logout and resets stores", async () => {
    const onSignOut = vi.fn();
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher onSignOut={onSignOut} />);

    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_logout", {
        accountId: "octocat",
      });
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders recent workspaces from data store repos", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    useDataStore.setState({
      pulls: [
        {
          id: 1,
          number: 1,
          title: "PR",
          repo: "octocat/hello",
          author: null,
          state: "open",
          isDraft: false,
          headRef: "feature",
          baseRef: "main",
          updatedAt: "2026-04-21T00:00:00Z",
          htmlUrl: null,
          ciState: null,
          reviewState: null,
          hasMention: false,
          requestedReviewers: [],
          mergedAt: null,
          additions: null,
          deletions: null,
          changedFiles: null,
        },
      ],
      issues: [],
      notifications: [],
      lastSyncedAt: null,
    });

    render(<WorkspaceSwitcher />);

    expect(screen.getByText("Recent workspaces")).toBeInTheDocument();
    expect(screen.getByText("octocat/hello")).toBeInTheDocument();
  });

  it("switches account, resets data, and triggers sync", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_switch_account") {
        return Promise.resolve({ login: "octocat", avatar_url: "avatar.png" });
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: true });
    useDataStore.setState({
      pulls: [
        {
          id: 1,
          number: 1,
          title: "PR",
          repo: "octocat/hello",
          author: null,
          state: "open",
          isDraft: false,
          headRef: "feature",
          baseRef: "main",
          updatedAt: "2026-04-21T00:00:00Z",
          htmlUrl: null,
          ciState: null,
          reviewState: null,
          hasMention: false,
          requestedReviewers: [],
          mergedAt: null,
          additions: null,
          deletions: null,
          changedFiles: null,
        },
      ],
      issues: [],
      notifications: [],
      lastSyncedAt: null,
    });
    render(<WorkspaceSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /octocat/ }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_switch_account", {
        accountId: "octocat",
      });
    });
    expect(invoke).toHaveBeenCalledWith("cmd_sync_now");
    expect(useDataStore.getState().pulls).toHaveLength(0);
    expect(useAuthStore.getState().user?.avatar_url).toBe("avatar.png");
  });

  it("shows attention badge per account from cache summary", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 1,
            ciFailures: 2,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: null,
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 4,
          },
        ]);
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);

    await waitFor(() => {
      expect(screen.getByText("work")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("3 attention items")).toBeInTheDocument();
    expect(screen.getByLabelText("4 attention items")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    useUiStore.setState({ workspaceSwitcherOpen: false });
    render(<WorkspaceSwitcher />);
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
  });
});
