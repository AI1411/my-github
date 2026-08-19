import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import InboxPage from "./InboxPage";
import { saveLastSnoozeOption } from "../lib/snooze";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/pulls/:owner/:repo/:number" element={<div>pull-detail</div>} />
        <Route path="/issues/:owner/:repo/:number" element={<div>issue-detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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

  it("shows a list skeleton while inbox data is loading", () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
    renderInbox();
    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });

  it("opens snooze picker with H and snoozes with number key", async () => {
    renderInbox();
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
    renderInbox();
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
    renderInbox();
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
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));

    // first item is review; one J should land on mention (empty CI is skipped)
    fireEvent.keyDown(window, { key: "j" });
    await waitFor(() => {
      expect(screen.getAllByText("You were mentioned").length).toBeGreaterThan(1);
    });

    fireEvent.keyDown(window, { key: "k" });
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

    renderInbox();
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

    renderInbox();
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
    renderInbox();
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
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });
    expect(invoke).not.toHaveBeenCalledWith(
      "cmd_pin_inbox_item",
      expect.objectContaining({ itemId: "pr-1" }),
    );
  });

  it("keeps the preview collapsed until an item is selected", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBe(1));
    expect(screen.queryByRole("button", { name: "Open in Browser" })).not.toBeInTheDocument();
    expect(screen.queryByText("Select an item to preview")).not.toBeInTheDocument();
  });

  it("opens the preview on click and collapses it with Escape", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    expect(await screen.findByRole("button", { name: "Open in Browser" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open in Browser" })).not.toBeInTheDocument();
    });
  });

  it("opens the in-app detail from Inbox with Enter", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(await screen.findByText("pull-detail")).toBeInTheDocument();
  });

  it("filters inbox items with Cmd+F list search", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.keyDown(window, { key: "f", metaKey: true });
    const input = await screen.findByRole("searchbox", { name: "List search" });
    fireEvent.change(input, { target: { value: "mentioned" } });
    await waitFor(() => {
      expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    });
    expect(screen.getByText("You were mentioned")).toBeInTheDocument();
  });

  it("clears list search on Escape without closing the detail preview", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    expect(await screen.findByRole("button", { name: "Open in Browser" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "f", metaKey: true });
    const input = await screen.findByRole("searchbox", { name: "List search" });
    fireEvent.change(input, { target: { value: "mentioned" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("searchbox", { name: "List search" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open in Browser" })).toBeInTheDocument();
  });

  it("surfaces pin failures to the user", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "cmd_get_inbox") {
        return {
          reviewRequests: [reviewItem],
          ciFailures: [],
          mentions: [],
        };
      }
      if (cmd === "cmd_pin_inbox_item") {
        throw new Error("pin failed");
      }
      return null;
    });

    renderInbox();
    await waitFor(() => expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Needs review")[0]);
    fireEvent.keyDown(window, { key: "p" });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("pin failed");
    });
  });
});
