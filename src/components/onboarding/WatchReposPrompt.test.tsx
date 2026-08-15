import { act, fireEvent, render, screen } from "@testing-library/react";
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
});
