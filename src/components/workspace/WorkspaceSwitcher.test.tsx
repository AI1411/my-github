import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useUiStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { DEFAULT_GITHUB_HOST } from "../../lib/githubHost";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderSwitcher(ui: ReactElement = <WorkspaceSwitcher />) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ workspaceSwitcherOpen: false, commandPaletteOpen: false });
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      status: "authenticated",
    });
    useDataStore.getState().reset();
    useSettingsStore.setState({
      hosts: [DEFAULT_GITHUB_HOST],
      accountHosts: {},
    });
  });

  it("renders Accounts header when open", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("shows host under each account", () => {
    useSettingsStore.setState({
      accountHosts: {
        octocat: "https://github.com",
        work: "https://github.example.com",
      },
    });
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: null,
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
        ]);
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    expect(screen.getByTestId("account-host-octocat")).toHaveTextContent("github.com");
  });

  it("renders the current user login", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("shows Active badge for current user", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Sign out button", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("shows Add another account and navigates to settings", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: "Add another account" }));
    expect(navigateMock).toHaveBeenCalledWith("/settings");
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(false);
  });

  it("shows ⌘1–⌘4 hints for listed accounts", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: null,
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
        ]);
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();
    await waitFor(() => {
      expect(screen.getByText("⌘1")).toBeInTheDocument();
    });
    expect(screen.getByText("⌘2")).toBeInTheDocument();
  });

  it("passes current account id to logout and resets stores", async () => {
    const onSignOut = vi.fn();
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher(<WorkspaceSwitcher onSignOut={onSignOut} />);

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

    renderSwitcher();

    expect(screen.getByText("Recent workspaces")).toBeInTheDocument();
    expect(screen.getByText("octocat/hello")).toBeInTheDocument();
  });

  it("switches account, resets data, and triggers sync", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: "w.png",
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
        ]);
      }
      if (cmd === "cmd_switch_account") {
        return Promise.resolve({ login: "work", avatar_url: "w.png" });
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
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByText("work")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /work/ }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_switch_account", {
        accountId: "work",
      });
    });
    expect(invoke).toHaveBeenCalledWith("cmd_sync_now");
    expect(useDataStore.getState().pulls).toHaveLength(0);
    expect(useAuthStore.getState().user?.login).toBe("work");
  });

  it("switches via ⌘2 when switcher is open", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: null,
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
        ]);
      }
      if (cmd === "cmd_switch_account") {
        return Promise.resolve({ login: "work", avatar_url: "" });
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: true });
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByText("work")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "2", metaKey: true });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_switch_account", {
        accountId: "work",
      });
    });
  });

  it("switches via ⌘2 globally when switcher is closed", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_account_attention_summaries") {
        return Promise.resolve([
          {
            login: "octocat",
            avatarUrl: null,
            isActive: true,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
          {
            login: "work",
            avatarUrl: null,
            isActive: false,
            reviewRequests: 0,
            ciFailures: 0,
            mentions: 0,
          },
        ]);
      }
      if (cmd === "cmd_switch_account") {
        return Promise.resolve({ login: "work", avatar_url: "" });
      }
      return Promise.resolve(null);
    });
    useUiStore.setState({ workspaceSwitcherOpen: false });
    renderSwitcher();

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_account_attention_summaries");
    });

    fireEvent.keyDown(window, { key: "2", metaKey: true });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_switch_account", {
        accountId: "work",
      });
    });
  });

  it("opens with ⌘T", () => {
    useUiStore.setState({ workspaceSwitcherOpen: false });
    renderSwitcher();
    fireEvent.keyDown(window, { key: "t", metaKey: true });
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(true);
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
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByText("work")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("3 attention items")).toBeInTheDocument();
    expect(screen.getByLabelText("4 attention items")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    useUiStore.setState({ workspaceSwitcherOpen: false });
    renderSwitcher();
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
  });
});
