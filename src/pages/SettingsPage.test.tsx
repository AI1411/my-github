import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import SettingsPage from "./SettingsPage";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "../stores/settingsStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
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
      hosts: [{ id: "github.com", baseUrl: "https://api.github.com", label: "github.com" }],
      accountHosts: {},
      notificationSettings: {
        enabled: true,
        ciFailures: "immediate",
        reviewRequests: "immediate",
        mentions: "immediate",
      },
      pollingInterval: "60s",
      pushSyncEnabled: false,
      dockBadgeEnabled: true,
      density: "comfortable",
      theme: "dark",
      layout: "inbox-first",
      shortcuts: DEFAULT_SHORTCUTS,
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
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
    renderPage();

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
    renderPage();

    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByTestId("active-account-host")).toHaveTextContent("github.com");
    expect(screen.getByRole("button", { name: "Add account" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reauth" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("shows host URL field when adding an account", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    expect(screen.getByLabelText("Host URL (optional)")).toBeInTheDocument();
  });

  it("adds and removes watched repositories", () => {
    renderPage();

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

    renderPage();
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

    renderPage();
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

    renderPage();
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
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    const input = screen.getByLabelText("Repository full name");
    fireEvent.change(input, { target: { value: "AI1411/manual-repo" } });
    fireEvent.submit(input.closest("form")!);

    expect(useSettingsStore.getState().watchedRepositories).toContain("AI1411/manual-repo");
  });

  it("bulk-adds starred repositories from the Starred tab", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_list_starred_repos") {
        return Promise.resolve(["octocat/hello", "octocat/world"]);
      }
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

    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    fireEvent.click(screen.getByRole("tab", { name: "Starred" }));

    fireEvent.click(await screen.findByLabelText("octocat/hello"));
    fireEvent.click(screen.getByLabelText("octocat/world"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));

    expect(useSettingsStore.getState().watchedRepositories).toEqual(["octocat/hello", "octocat/world"]);
  });

  it("changes notification polling interval", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "5 min" }));

    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
  });

  it("toggles quiet hours on the notifications tab", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(useSettingsStore.getState().quietHours.enabled).toBe(false);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Skip OS notifications during quiet hours" }),
    );

    expect(useSettingsStore.getState().quietHours.enabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Quiet hours start"), {
      target: { value: "21:00" },
    });
    fireEvent.change(screen.getByLabelText("Quiet hours end"), {
      target: { value: "07:30" },
    });
    expect(useSettingsStore.getState().quietHours).toMatchObject({
      enabled: true,
      start: "21:00",
      end: "07:30",
    });
  });

  it("toggles push-assisted sync without claiming real webhooks", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(useSettingsStore.getState().pushSyncEnabled).toBe(false);

    fireEvent.click(screen.getByRole("checkbox", { name: "Enable push-assisted sync" }));

    expect(useSettingsStore.getState().pushSyncEnabled).toBe(true);
    expect(screen.getByText(/cannot host a durable public GitHub webhook/i)).toBeInTheDocument();
    expect(screen.getByText(/not inbound webhooks/i)).toBeInTheDocument();
  });

  it("customizes shortcuts", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Shortcuts" }));
    fireEvent.change(screen.getByLabelText("Command palette shortcut"), {
      target: { value: "Alt+K" },
    });

    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe("Alt+K");
  });

  it("sets theme and home layout", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Pulls first" }));

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(useSettingsStore.getState().layout).toBe("pulls-first");
  });

  it("saves and activates a work mode from current settings", () => {
    useSettingsStore.setState({
      watchedRepositories: ["acme/app"],
      notificationRules: [
        { id: "r1", repo: "acme/app", kind: "ciFailures", priority: "immediate" },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Repositories" }));
    fireEvent.change(screen.getByLabelText("New work mode name"), {
      target: { value: "Work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current as mode" }));

    expect(useSettingsStore.getState().workModes).toHaveLength(1);
    expect(useSettingsStore.getState().workModes[0].name).toBe("Work");
    expect(useSettingsStore.getState().workModes[0].watchedRepositories).toEqual(["acme/app"]);

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    expect(useSettingsStore.getState().activeWorkModeId).toBeTruthy();
  });

  it("warns when shortcuts conflict", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Shortcuts" }));
    fireEvent.change(screen.getByLabelText("Move up shortcut"), {
      target: { value: "J" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/Conflicting shortcuts/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/Move up/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Move down/);
  });

  it("shows about version and GitHub API rate limit", async () => {
    renderPage();

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

    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "About" }));

    await waitFor(() => {
      expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });
});
