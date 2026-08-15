import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import SettingsPage from "./SettingsPage";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../stores/settingsStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: null,
      status: "authenticated",
    });
    useDataStore.setState({
      pulls: [],
      issues: [],
      notifications: [],
      lastSyncedAt: null,
    });
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
    });
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_sync_status") {
        return Promise.resolve({
          isRunning: false,
          lastStartedAtEpoch: 1760000000,
          lastFinishedAtEpoch: 1760000001,
          lastStatus: "success",
          lastReport: null,
          lastRateLimit: { remaining: 4321, reset: 1770000000 },
        });
      }
      return Promise.resolve(null);
    });
  });

  it("renders the M8 settings tabs", () => {
    render(<SettingsPage />);

    for (const tab of [
      "Accounts",
      "Repositories",
      "Notifications",
      "Appearance",
      "Shortcuts",
      "About",
    ]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }
  });

  it("shows the active account controls", () => {
    render(<SettingsPage />);

    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add account" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reauth" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("adds and removes watched repositories", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    fireEvent.change(screen.getByLabelText("Repository full name"), {
      target: { value: "AI1411/my-github" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(screen.getByText("AI1411/my-github")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove AI1411/my-github" }));

    expect(screen.queryByText("AI1411/my-github")).not.toBeInTheDocument();
  });

  it("shows repository suggestions while typing and adds on click", async () => {
    vi.useFakeTimers();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_search_repositories") {
        return Promise.resolve([
          { fullName: "octocat/hello", description: "A repo", stars: 42, private: false },
          { fullName: "octocat/world", description: null, stars: 1, private: true },
        ]);
      }
      return Promise.resolve(null);
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    fireEvent.change(screen.getByLabelText("Repository full name"), {
      target: { value: "octo" },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();

    expect(invoke).toHaveBeenCalledWith("cmd_search_repositories", { query: "octo" });
    const option = await screen.findByRole("option", { name: /octocat\/hello/ });
    fireEvent.mouseDown(option);

    expect(useSettingsStore.getState().watchedRepositories).toContain("octocat/hello");
    expect(screen.getByLabelText("Repository full name")).toHaveValue("");
  });

  it("adds a highlighted suggestion with arrow keys and Enter", async () => {
    vi.useFakeTimers();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_search_repositories") {
        return Promise.resolve([
          { fullName: "octocat/hello", description: null, stars: 42, private: false },
          { fullName: "octocat/world", description: null, stars: 1, private: false },
        ]);
      }
      return Promise.resolve(null);
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    const input = screen.getByLabelText("Repository full name");
    fireEvent.change(input, { target: { value: "octo" } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();

    await screen.findByRole("option", { name: /octocat\/hello/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useSettingsStore.getState().watchedRepositories).toEqual(["octocat/world"]);
  });

  it("excludes already watched repositories from suggestions", async () => {
    useSettingsStore.setState({ watchedRepositories: ["octocat/hello"] });
    vi.useFakeTimers();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_search_repositories") {
        return Promise.resolve([
          { fullName: "octocat/hello", description: null, stars: 42, private: false },
          { fullName: "octocat/world", description: null, stars: 1, private: false },
        ]);
      }
      return Promise.resolve(null);
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    fireEvent.change(screen.getByLabelText("Repository full name"), {
      target: { value: "octo" },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();

    await screen.findByRole("option", { name: /octocat\/world/ });
    expect(screen.queryByRole("option", { name: /octocat\/hello/ })).not.toBeInTheDocument();
  });

  it("still adds manual input with Enter when no suggestion is highlighted", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    const input = screen.getByLabelText("Repository full name");
    fireEvent.change(input, { target: { value: "AI1411/manual-repo" } });
    fireEvent.submit(input.closest("form")!);

    expect(useSettingsStore.getState().watchedRepositories).toContain("AI1411/manual-repo");
  });

  it("changes notification polling interval", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "5 min" }));

    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
  });

  it("customizes shortcuts", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Shortcuts" }));
    fireEvent.change(screen.getByLabelText("Command palette shortcut"), {
      target: { value: "Ctrl+K" },
    });

    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe("Ctrl+K");
  });

  it("shows about version and GitHub API rate limit", async () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "About" }));

    expect(screen.getByText("About my-github")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("4321 remaining")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("cmd_get_sync_status");
    expect(invoke).not.toHaveBeenCalledWith("cmd_sync_now");
  });

  it("shows an empty rate-limit state when sync status has no rate limit", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_sync_status") {
        return Promise.resolve({
          isRunning: false,
          lastStartedAtEpoch: null,
          lastFinishedAtEpoch: null,
          lastStatus: null,
          lastReport: null,
          lastRateLimit: null,
        });
      }
      return Promise.resolve(null);
    });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "About" }));

    await waitFor(() => {
      expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });
});
