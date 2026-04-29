import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { registerPulseNotificationClickHandler } from "../lib/notifications";
import ActivityPage from "./ActivityPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/notifications", () => ({
  registerPulseNotificationClickHandler: vi.fn().mockResolvedValue(undefined),
  sendPulseNotification: vi.fn().mockResolvedValue(true),
}));

const navigate = vi.fn();

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

function renderPage() {
  return render(
    <MemoryRouter>
      <ActivityPage />
    </MemoryRouter>,
  );
}

describe("ActivityPage read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_get_notifications") return Promise.resolve(notifications);
      return Promise.resolve(null);
    });
  });

  it("marks all read and refetches notifications", async () => {
    renderPage();
    await screen.findByText("Mentioned issue");

    fireEvent.click(screen.getByText("Mark all read"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_all_notifications_read");
    });
    await waitFor(() => {
      expect(
        (invoke as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([cmd]) => cmd === "cmd_get_notifications",
        ),
      ).toHaveLength(2);
    });
  });

  it("marks one unread notification read and navigates to issue detail", async () => {
    renderPage();
    await screen.findByText("Mentioned issue");

    fireEvent.click(screen.getByText("Mentioned issue"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_mark_notification_read", {
        threadId: "thread-1",
      });
    });
    expect(navigate).toHaveBeenCalledWith("/issues/octocat/hello/7");
  });

  it("routes notification click actions through navigate", async () => {
    renderPage();

    await waitFor(() => {
      expect(registerPulseNotificationClickHandler).toHaveBeenCalledTimes(1);
    });
    const onOpenRoute = (
      registerPulseNotificationClickHandler as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as (route: string) => void;
    onOpenRoute("/pulls/octocat/hello/9");

    expect(navigate).toHaveBeenCalledWith("/pulls/octocat/hello/9");
  });
});
