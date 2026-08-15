import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import InboxPage from "./InboxPage";
import { saveLastSnoozeOption } from "../lib/snooze";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const reviewItem = {
  id: "pr-1",
  kind: "review_requested",
  repo: "octocat/hello",
  number: 5,
  title: "Needs review",
  htmlUrl: "https://github.com/octocat/hello/pull/5",
  updatedAt: new Date().toISOString(),
  unread: true,
  pinned: false,
};

const mentionItem = {
  id: "issue-1",
  kind: "mention",
  repo: "octocat/hello",
  number: 9,
  title: "You were mentioned",
  htmlUrl: "https://github.com/octocat/hello/issues/9",
  updatedAt: new Date().toISOString(),
  unread: true,
  pinned: false,
};

describe("InboxPage snooze shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: null });
    useDataStore.setState({ pulls: [] });
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "cmd_get_inbox") {
        return {
          reviewRequests: [reviewItem],
          ciFailures: [],
          mentions: [mentionItem],
        };
      }
      return null;
    });
  });

  it("opens snooze picker with H and snoozes with number key", async () => {
    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);

    fireEvent.keyDown(window, { key: "h" });
    const dialog = await screen.findByRole("dialog", { name: "Snooze until" });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "2" });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "cmd_snooze_inbox_item",
        expect.objectContaining({ itemId: "pr-1", snoozedUntil: expect.any(Number) }),
      );
    });
    expect(localStorage.getItem("pulse-inbox-last-snooze")).toBe("tomorrow");
  });

  it("applies last snooze option with Shift+H", async () => {
    saveLastSnoozeOption("1h");
    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);

    fireEvent.keyDown(window, { key: "h", shiftKey: true });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "cmd_snooze_inbox_item",
        expect.objectContaining({ itemId: "pr-1", snoozedUntil: expect.any(Number) }),
      );
    });
  });

  it("navigates across sections with J before snoozing", async () => {
    render(<InboxPage />);
    await waitFor(() =>
      expect(screen.getAllByText("You were mentioned").length).toBeGreaterThan(0),
    );

    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "h", shiftKey: true });
    // no last option → picker
    const dialog = screen.getByRole("dialog", { name: "Snooze until" });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText("Snooze until Next week"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "cmd_snooze_inbox_item",
        expect.objectContaining({ itemId: "issue-1" }),
      );
    });
  });

  it("moves J/K across Review and Mentions without stopping at empty CI", async () => {
    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));

    // first item is review; one J should land on mention (empty CI is skipped)
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getAllByText("You were mentioned").length).toBeGreaterThan(1);
    });

    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getAllByText("Needs review").length).toBeGreaterThan(1);
    });
  });

  it("dismisses with X and focuses the next item", async () => {
    let inbox = {
      reviewRequests: [reviewItem],
      ciFailures: [],
      mentions: [mentionItem],
    };
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd === "cmd_get_inbox") return inbox;
      if (cmd === "cmd_dismiss_inbox_item") {
        const itemId = (args as { itemId: string }).itemId;
        inbox = {
          ...inbox,
          reviewRequests: inbox.reviewRequests.filter((item) => item.id !== itemId),
          mentions: inbox.mentions.filter((item) => item.id !== itemId),
        };
        return null;
      }
      return null;
    });

    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);

    fireEvent.keyDown(window, { key: "x" });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_dismiss_inbox_item", { itemId: "pr-1" });
    });
    await waitFor(() => {
      expect(screen.getAllByText("You were mentioned").length).toBeGreaterThan(1);
    });
  });

  it("clears selection after Shift+X dismisses all", async () => {
    let calls = 0;
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "cmd_get_inbox") {
        calls += 1;
        if (calls === 1) {
          return {
            reviewRequests: [reviewItem],
            ciFailures: [],
            mentions: [mentionItem],
          };
        }
        return { reviewRequests: [], ciFailures: [], mentions: [] };
      }
      return null;
    });

    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.keyDown(window, { key: "x", shiftKey: true });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "cmd_dismiss_inbox_items",
        expect.objectContaining({ itemIds: expect.arrayContaining(["pr-1", "issue-1"]) }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    });
  });

  it("toggles pin on the selected item with P", async () => {
    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    fireEvent.keyDown(window, { key: "p" });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_pin_inbox_item", {
        itemId: "pr-1",
        pinned: true,
      });
    });
  });

  it("does not pin when P is the second key of G then P", async () => {
    render(<InboxPage />);
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });
    expect(invoke).not.toHaveBeenCalledWith(
      "cmd_pin_inbox_item",
      expect.objectContaining({ itemId: "pr-1" }),
    );
  });
});
