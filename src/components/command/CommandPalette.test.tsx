import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { CommandPalette } from "./CommandPalette";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

const mockedInvoke = vi.mocked(invoke);

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    useUiStore.setState({ commandPaletteOpen: true, workspaceSwitcherOpen: false });
    useDataStore.setState({ pulls: [], issues: [] });
    useSettingsStore.setState({ savedSearches: [], recentPullsByAccount: {} });
    mockedInvoke.mockReset();
    mockedInvoke.mockResolvedValue([]);
  });

  it("renders search input when open", () => {
    renderPalette();
    expect(screen.getByPlaceholderText(/Search or jump to/)).toBeInTheDocument();
  });

  it("shows digest, sync, mark-all, and switch-account actions", async () => {
    renderPalette();
    expect(screen.getByText("Go to Digest")).toBeInTheDocument();
    expect(screen.getByText("Sync now")).toBeInTheDocument();
    expect(screen.getByText("Mark all as read")).toBeInTheDocument();
    expect(screen.getByText("Switch account")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sync now"));
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("cmd_sync_now");
    });
  });

  it("opens the workspace switcher from Switch account", () => {
    renderPalette();
    fireEvent.click(screen.getByText("Switch account"));
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(true);
  });

  it("surfaces failing CI pulls as next actions above nav", () => {
    useDataStore.setState({
      pulls: [
        {
          id: 1,
          number: 9,
          title: "Broken build",
          repo: "octocat/hello",
          author: "octocat",
          state: "open",
          isDraft: false,
          headRef: "fix",
          baseRef: "main",
          updatedAt: "2026-08-15T00:00:00Z",
          htmlUrl: null,
          ciState: "failure",
          reviewState: null,
          hasMention: false,
          requestedReviewers: [],
          mergedAt: null,
          additions: null,
          deletions: null,
          changedFiles: null,
        },
      ],
    });
    renderPalette();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Broken build");
    expect(options[0]).toHaveTextContent("CI failing");
    expect(screen.getByText("Go to Inbox")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    useUiStore.setState({ commandPaletteOpen: false });
    renderPalette();
    expect(screen.queryByPlaceholderText(/Search or jump to/)).not.toBeInTheDocument();
  });

  it("closes on Esc key", () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search or jump to/);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("navigates selection down with ArrowDown", () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search or jump to/);
    const firstItem = screen.getAllByRole("option")[0];
    expect(firstItem).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
  });

  it("closes backdrop click", () => {
    renderPalette();
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("lists saved searches when the query is empty", () => {
    useSettingsStore.setState({
      savedSearches: [{ id: "s1", name: "Review requests", query: "is:pr review-requested:@me" }],
    });
    renderPalette();
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    expect(screen.getByText("Review requests")).toBeInTheDocument();
    expect(screen.getByText("is:pr review-requested:@me")).toBeInTheDocument();
  });

  it("lists recent pulls when the query is empty", () => {
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: null,
      status: "authenticated",
    });
    useSettingsStore.setState({
      recentPullsByAccount: {
        octocat: [
          {
            repo: "octocat/hello",
            number: 4,
            title: "Yesterday's PR",
            openedAt: "2026-08-14T00:00:00.000Z",
          },
        ],
      },
    });
    renderPalette();
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Yesterday's PR")).toBeInTheDocument();
    expect(screen.getByText(/Recent · octocat\/hello #4/)).toBeInTheDocument();
  });

  it("runs GitHub search for is: queries and shows results", async () => {
    mockedInvoke.mockResolvedValue([
      {
        id: 42,
        number: 7,
        title: "Ship advanced search",
        state: "open",
        htmlUrl: "https://github.com/octocat/hello/pull/7",
        repo: "octocat/hello",
        kind: "pull",
      },
    ]);
    renderPalette();
    const input = screen.getByPlaceholderText(/Search or jump to/);
    fireEvent.change(input, { target: { value: "is:pr review-requested:@me" } });

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("cmd_search_github", {
        query: "is:pr review-requested:@me",
      });
    });
    expect(await screen.findByText("Ship advanced search")).toBeInTheDocument();
    expect(screen.getByText("Save this search")).toBeInTheDocument();
  });

  it("applies a saved search without closing the palette", async () => {
    mockedInvoke.mockResolvedValue([]);
    useSettingsStore.setState({
      savedSearches: [{ id: "s1", name: "Open issues", query: "is:issue is:open" }],
    });
    renderPalette();
    fireEvent.click(screen.getByText("Open issues"));
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    expect(screen.getByDisplayValue("is:issue is:open")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("cmd_search_github", {
        query: "is:issue is:open",
      });
    });
  });

  it("toggles search mode with Tab", () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search or jump to/);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/GitHub search/)).toBeInTheDocument();
  });
});
