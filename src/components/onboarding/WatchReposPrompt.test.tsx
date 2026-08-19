import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../../stores/settingsStore";
import { WatchReposPrompt } from "./WatchReposPrompt";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("WatchReposPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.setState({
      watchedRepositories: [],
      watchOnboardingDismissed: false,
    });
  });

  it("does not render when onboarding was skipped", () => {
    useSettingsStore.setState({ watchOnboardingDismissed: true });
    render(<WatchReposPrompt />);
    expect(screen.queryByRole("dialog", { name: "Watch repositories" })).not.toBeInTheDocument();
  });

  it("does not render when repositories are already watched", () => {
    useSettingsStore.setState({ watchedRepositories: ["octocat/hello"] });
    render(<WatchReposPrompt />);
    expect(screen.queryByRole("dialog", { name: "Watch repositories" })).not.toBeInTheDocument();
  });

  it("persists skip so the prompt stays dismissed", () => {
    render(<WatchReposPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(useSettingsStore.getState().watchOnboardingDismissed).toBe(true);
    expect(screen.queryByRole("dialog", { name: "Watch repositories" })).not.toBeInTheDocument();
  });

  it("adds a searched repository and closes", async () => {
    vi.useFakeTimers();
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([
      { fullName: "octocat/hello", description: "A repo", stars: 1, private: false },
    ]);

    render(<WatchReposPrompt />);
    fireEvent.change(screen.getByLabelText("Search repositories"), {
      target: { value: "octo" },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();

    fireEvent.click(await screen.findByRole("button", { name: /octocat\/hello/ }));
    expect(useSettingsStore.getState().watchedRepositories).toEqual(["octocat/hello"]);
    expect(screen.queryByRole("dialog", { name: "Watch repositories" })).not.toBeInTheDocument();
  });

  it("bulk-adds starred repositories from the Starred tab", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_list_starred_repos") {
        return Promise.resolve(["octocat/hello", "octocat/world"]);
      }
      return Promise.resolve([]);
    });

    render(<WatchReposPrompt />);
    fireEvent.click(screen.getByRole("tab", { name: "Starred" }));

    fireEvent.click(await screen.findByLabelText("octocat/hello"));
    fireEvent.click(screen.getByLabelText("octocat/world"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));

    expect(useSettingsStore.getState().watchedRepositories).toEqual(["octocat/hello", "octocat/world"]);
    expect(screen.queryByRole("dialog", { name: "Watch repositories" })).not.toBeInTheDocument();
  });

  it("shows source tabs for search, starred, and org", () => {
    render(<WatchReposPrompt />);
    expect(screen.getByRole("tab", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Starred" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Org" })).toBeInTheDocument();
  });
});
