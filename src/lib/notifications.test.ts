import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Options } from "@tauri-apps/plugin-notification";
import {
  ensureNotificationPermission,
  registerAppNotificationClickHandler,
  sendAppNotification,
} from "./notifications";

const notificationPlugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  onAction: vi.fn(),
  registerActionTypes: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => notificationPlugin);

const settings = {
  enabled: true,
  ciFailures: true,
  reviewRequests: true,
  mentions: true,
};

const reviewNotification = {
  id: "thread-1",
  reason: "review_requested",
  repo: "AI1411/my-github",
  subjectTitle: "Review this PR",
  subjectType: "PullRequest",
  htmlUrl: "https://github.com/AI1411/my-github/pull/189",
  unread: true,
  updatedAt: "2026-04-29T00:00:00Z",
};

describe("ensureNotificationPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not request permission when already granted", async () => {
    notificationPlugin.isPermissionGranted.mockResolvedValue(true);

    await expect(ensureNotificationPermission()).resolves.toBe(true);

    expect(notificationPlugin.requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission when missing", async () => {
    notificationPlugin.isPermissionGranted.mockResolvedValue(false);
    notificationPlugin.requestPermission.mockResolvedValue("granted");

    await expect(ensureNotificationPermission()).resolves.toBe(true);

    expect(notificationPlugin.requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe("sendAppNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationPlugin.isPermissionGranted.mockResolvedValue(true);
  });

  it("sends review request notifications with click route payload", async () => {
    await sendAppNotification(reviewNotification, settings);

    expect(notificationPlugin.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        actionTypeId: "pulse-open",
        body: "AI1411/my-github · Review this PR",
        extra: { route: "/pulls/AI1411/my-github/189" },
        title: "Review requested",
      }),
    );
  });

  it("skips disabled notification settings", async () => {
    await sendAppNotification(reviewNotification, {
      ...settings,
      enabled: false,
    });

    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });

  it("skips disabled notification types", async () => {
    await sendAppNotification(reviewNotification, {
      ...settings,
      reviewRequests: false,
    });

    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });
});

describe("registerAppNotificationClickHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers an open action and forwards route payloads", async () => {
    let callback: ((notification: Options) => void) | null = null;
    notificationPlugin.onAction.mockImplementation((cb) => {
      callback = cb;
      return Promise.resolve(vi.fn());
    });
    const onOpenRoute = vi.fn();

    await registerAppNotificationClickHandler(onOpenRoute);
    const registeredCallback = callback as unknown as (notification: Options) => void;
    expect(registeredCallback).toBeTypeOf("function");
    registeredCallback({
      title: "Review requested",
      extra: { route: "/pulls/AI1411/my-github/189" },
    });

    expect(notificationPlugin.registerActionTypes).toHaveBeenCalledWith([
      {
        id: "pulse-open",
        actions: [{ id: "open", title: "Open in my-github", foreground: true }],
      },
    ]);
    expect(onOpenRoute).toHaveBeenCalledWith("/pulls/AI1411/my-github/189");
  });
});
