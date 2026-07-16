import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { NotificationPollingContext } from "../features/activity/NotificationPollingContext";
import { useDataStore } from "../stores/dataStore";
import ActivityPage from "./ActivityPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const navigate = vi.fn();
const refetch = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const notifications = [
  {
    id: "thread-1",
    reason: "mention",
    repo: "octocat/hello",
    subjectTitle: "Mentioned issue",
    subjectType: "Issue",
    htmlUrl: "https://github.com/octocat/hello/issues/7",
    unread: true,
    updatedAt: new Date().toISOString(),
  },
];

function renderPage(error: string | null = null) {
  return render(
    <MemoryRouter>
      <NotificationPollingContext.Provider value={{ loading: false, error, refetch }}>
        <ActivityPage />
      </NotificationPollingContext.Provider>
    </MemoryRouter>,
  );
}

describe("ActivityPage read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    refetch.mockReset();
    useDataStore.setState({ notifications });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("renders shared notifications without fetching automatically", () => {
    renderPage();

    expect(screen.getByText("Mentioned issue")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("cmd_get_notifications");
  });

  it("marks all read and refetches shared notifications", async () => {
    renderPage();

    fireEvent.click(screen.getByText("Mark all read"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_all_notifications_read");
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("marks an unread notification, refetches, then navigates to its route", async () => {
    renderPage();

    fireEvent.click(screen.getByText("Mentioned issue"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_notification_read", {
        threadId: "thread-1",
      });
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/issues/octocat/hello/7");
    expect(refetch.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });

  it("shows a compact error alongside existing notifications", () => {
    renderPage("Error: offline");

    expect(screen.getByText("Mentioned issue")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Error: offline");
    expect(screen.queryByText("Failed to load activity")).not.toBeInTheDocument();
  });

  it("shows the failed state when loading fails without cached notifications", () => {
    useDataStore.setState({ notifications: [] });

    renderPage("Error: offline");

    expect(screen.getByText("Failed to load activity")).toBeInTheDocument();
    expect(screen.queryByText("No activity")).not.toBeInTheDocument();
  });
});
