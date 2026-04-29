import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import SettingsPage from "./SettingsPage";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import {
  DEFAULT_SHORTCUTS,
  useSettingsStore,
} from "../stores/settingsStore";

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
        ciFailures: true,
        reviewRequests: true,
        mentions: true,
      },
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
    });
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_sync_now") {
        return Promise.resolve({
          rateLimit: { remaining: 4321, reset: 1770000000 },
          syncedAtEpoch: 1760000000,
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

    fireEvent.click(
      screen.getByRole("button", { name: "Remove AI1411/my-github" }),
    );

    expect(screen.queryByText("AI1411/my-github")).not.toBeInTheDocument();
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

    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe(
      "Ctrl+K",
    );
  });

  it("shows about version and GitHub API rate limit", async () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "About" }));

    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("4321 remaining")).toBeInTheDocument();
    });
  });
});
