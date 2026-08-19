import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Options } from "@tauri-apps/plugin-notification";
import {
  enabledForKind,
  ensureNotificationPermission,
  NOTIFICATION_GROUP_WINDOW_MS,
  priorityForKind,
  registerAppNotificationClickHandler,
  resetNotificationGroupsForTests,
  sendAppNotification,
  sendReleaseNotification,
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
  ciFailures: "immediate" as const,
  reviewRequests: "immediate" as const,
  mentions: "immediate" as const,
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

const ciNotification = {
  id: "ci-1",
  reason: "ci",
  repo: "AI1411/my-github",
  subjectTitle: "CI is failing",
  subjectType: "CheckSuite",
  htmlUrl: "https://github.com/AI1411/my-github/pull/189",
  unread: true,
  updatedAt: "2026-04-29T00:00:00Z",
};

async function flushNotificationGroups() {
  await vi.advanceTimersByTimeAsync(NOTIFICATION_GROUP_WINDOW_MS);
}

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

describe("priorityForKind / enabledForKind", () => {
  it("falls back to global settings when no repo rule exists", () => {
    expect(priorityForKind("ciFailure", settings, { repo: "octocat/hello" })).toBe("immediate");
    expect(
      priorityForKind("ciFailure", { ...settings, ciFailures: "off" }, { repo: "octocat/hello" }),
    ).toBe("off");
    expect(enabledForKind("ciFailure", settings, "octocat/hello", {})).toBe(true);
    expect(
      enabledForKind("ciFailure", { ...settings, ciFailures: "off" }, "octocat/hello", {}),
    ).toBe(false);
  });

  it("prefers notificationRules priority over global settings", () => {
    const notificationRules = [
      {
        id: "1",
        repo: "octocat/hello",
        kind: "ciFailures" as const,
        priority: "digest" as const,
      },
      {
        id: "2",
        repo: "octocat/hello",
        kind: "reviewRequests" as const,
        priority: "immediate" as const,
      },
      {
        id: "3",
        repo: "octocat/hello",
        kind: "mentions" as const,
        priority: "off" as const,
      },
    ];
    expect(
      priorityForKind("ciFailure", settings, { repo: "octocat/hello", notificationRules }),
    ).toBe("digest");
    expect(
      priorityForKind("reviewRequest", settings, { repo: "octocat/hello", notificationRules }),
    ).toBe("immediate");
    expect(priorityForKind("mention", settings, { repo: "octocat/hello", notificationRules })).toBe(
      "off",
    );
    expect(enabledForKind("ciFailure", settings, "octocat/hello", {}, notificationRules)).toBe(
      false,
    );
    expect(enabledForKind("reviewRequest", settings, "octocat/hello", {}, notificationRules)).toBe(
      true,
    );
  });

  it("prefers notificationRules over legacy boolean repo rules", () => {
    const repoRules = {
      "octocat/hello": { ciFailures: false, reviewRequests: true, mentions: true },
    };
    const notificationRules = [
      {
        id: "1",
        repo: "octocat/hello",
        kind: "ciFailures" as const,
        priority: "immediate" as const,
      },
    ];
    expect(
      priorityForKind("ciFailure", settings, {
        repo: "octocat/hello",
        repoRules,
        notificationRules,
      }),
    ).toBe("immediate");
  });

  it("uses legacy boolean repo rules when no notificationRule matches", () => {
    const rules = {
      "octocat/hello": { ciFailures: false, reviewRequests: true, mentions: false },
    };
    expect(enabledForKind("ciFailure", settings, "octocat/hello", rules)).toBe(false);
    expect(enabledForKind("reviewRequest", settings, "octocat/hello", rules)).toBe(true);
    expect(enabledForKind("mention", settings, "octocat/hello", rules)).toBe(false);
  });

  it("keeps the master switch authoritative even with a permissive rule", () => {
    const notificationRules = [
      {
        id: "1",
        repo: "octocat/hello",
        kind: "ciFailures" as const,
        priority: "immediate" as const,
      },
    ];
    expect(
      priorityForKind(
        "ciFailure",
        { ...settings, enabled: false },
        { repo: "octocat/hello", notificationRules },
      ),
    ).toBe("off");
  });

  it("uses global settings for repositories without a rule", () => {
    const notificationRules = [
      {
        id: "1",
        repo: "octocat/other",
        kind: "mentions" as const,
        priority: "off" as const,
      },
    ];
    expect(priorityForKind("mention", settings, { repo: "octocat/hello", notificationRules })).toBe(
      "immediate",
    );
  });

  it("treats digest delivery as non-immediate", () => {
    expect(
      enabledForKind("mention", { ...settings, mentions: "digest" }, "octocat/hello", {}),
    ).toBe(false);
    expect(
      priorityForKind("mention", { ...settings, mentions: "digest" }, { repo: "octocat/hello" }),
    ).toBe("digest");
  });
});

describe("sendAppNotification with repo rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetNotificationGroupsForTests();
    notificationPlugin.isPermissionGranted.mockResolvedValue(true);
  });

  afterEach(() => {
    resetNotificationGroupsForTests();
    vi.useRealTimers();
  });

  it("suppresses a notification disabled by its repo rule", async () => {
    const sent = await sendAppNotification(reviewNotification, settings, {
      "AI1411/my-github": { ciFailures: true, reviewRequests: false, mentions: true },
    });
    expect(sent).toBe(false);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });

  it("delivers a notification allowed by its repo rule", async () => {
    const sent = await sendAppNotification(reviewNotification, settings, {
      "AI1411/my-github": { ciFailures: false, reviewRequests: true, mentions: false },
    });
    expect(sent).toBe(true);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("respects notificationRules priority over legacy rules", async () => {
    const sent = await sendAppNotification(
      reviewNotification,
      settings,
      {
        "AI1411/my-github": { ciFailures: true, reviewRequests: false, mentions: true },
      },
      [
        {
          id: "r1",
          repo: "AI1411/my-github",
          kind: "reviewRequests",
          priority: "immediate",
        },
      ],
    );
    expect(sent).toBe(true);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("suppresses when notificationRules priority is digest", async () => {
    const sent = await sendAppNotification(reviewNotification, settings, {}, [
      {
        id: "r1",
        repo: "AI1411/my-github",
        kind: "reviewRequests",
        priority: "digest",
      },
    ]);
    expect(sent).toBe(false);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });
});

describe("sendAppNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetNotificationGroupsForTests();
    notificationPlugin.isPermissionGranted.mockResolvedValue(true);
  });

  afterEach(() => {
    resetNotificationGroupsForTests();
    vi.useRealTimers();
  });

  it("sends review request notifications with click route payload", async () => {
    await sendAppNotification(reviewNotification, settings);
    await flushNotificationGroups();

    expect(notificationPlugin.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        actionTypeId: "my-github-open",
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
    await flushNotificationGroups();

    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });

  it("skips disabled notification types", async () => {
    await sendAppNotification(reviewNotification, {
      ...settings,
      reviewRequests: "off",
    });
    await flushNotificationGroups();

    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });

  it("collapses same repo and kind within 60s into CI failing ×N", async () => {
    await sendAppNotification({ ...ciNotification, id: "ci-1" }, settings);
    await sendAppNotification({ ...ciNotification, id: "ci-2" }, settings);
    await sendAppNotification({ ...ciNotification, id: "ci-3" }, settings);

    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).toHaveBeenCalledTimes(1);
    expect(notificationPlugin.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "CI failed",
        body: "CI failing ×3",
      }),
    );
  });

  it("does not collapse different repos or kinds", async () => {
    await sendAppNotification(reviewNotification, settings);
    await sendAppNotification(
      { ...reviewNotification, id: "other", repo: "octocat/hello" },
      settings,
    );
    await sendAppNotification(ciNotification, settings);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).toHaveBeenCalledTimes(3);
  });

  it("skips OS notifications during quiet hours", async () => {
    vi.setSystemTime(new Date("2026-08-15T23:00:00"));
    const sent = await sendAppNotification(reviewNotification, settings, undefined, undefined, {
      enabled: true,
      start: "22:00",
      end: "08:00",
    });
    expect(sent).toBe(false);
    await flushNotificationGroups();
    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });
});

describe("sendReleaseNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificationPlugin.isPermissionGranted.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips release notifications during quiet hours", async () => {
    vi.setSystemTime(new Date("2026-08-15T23:00:00"));
    const sent = await sendReleaseNotification(
      {
        repo: "AI1411/my-github",
        tagName: "v1.0.0",
        htmlUrl: "https://github.com/AI1411/my-github/releases/tag/v1.0.0",
      },
      { enabled: true, start: "22:00", end: "08:00" },
    );
    expect(sent).toBe(false);
    expect(notificationPlugin.sendNotification).not.toHaveBeenCalled();
  });
});

describe("registerAppNotificationClickHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("single-flights concurrent registration, retries failures, and disposes by handler generation", async () => {
    let callback: ((notification: Options) => void) | null = null;
    let finishRegistration!: () => void;
    const registrationGate = new Promise<void>((resolve) => {
      finishRegistration = resolve;
    });
    notificationPlugin.registerActionTypes
      .mockRejectedValueOnce(new Error("registration failed"))
      .mockReturnValueOnce(registrationGate);
    notificationPlugin.onAction.mockImplementation((cb) => {
      callback = cb;
      return Promise.resolve(vi.fn());
    });
    const firstHandler = vi.fn();
    const latestHandler = vi.fn();

    await expect(registerAppNotificationClickHandler(firstHandler)).rejects.toThrow(
      "registration failed",
    );

    const firstRegistration = registerAppNotificationClickHandler(firstHandler);
    const latestRegistration = registerAppNotificationClickHandler(latestHandler);
    await Promise.resolve();

    expect(notificationPlugin.registerActionTypes).toHaveBeenCalledTimes(2);
    finishRegistration();
    const [disposeFirst, disposeLatest] = await Promise.all([
      firstRegistration,
      latestRegistration,
    ]);

    const registeredCallback = callback as unknown as (notification: Options) => void;
    expect(registeredCallback).toBeTypeOf("function");
    registeredCallback({
      title: "Issue mentioned",
      extra: { route: "/issues/octocat/hello/7" },
    });

    expect(notificationPlugin.registerActionTypes).toHaveBeenCalledWith([
      {
        id: "my-github-open",
        actions: [{ id: "open", title: "Open in my-github", foreground: true }],
      },
    ]);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledWith("/issues/octocat/hello/7");
    expect(notificationPlugin.onAction).toHaveBeenCalledTimes(1);

    disposeFirst();
    registeredCallback({
      title: "Pull request reviewed",
      extra: { route: "/pulls/octocat/hello/8" },
    });
    expect(latestHandler).toHaveBeenCalledWith("/pulls/octocat/hello/8");

    disposeLatest();
    registeredCallback({
      title: "Issue mentioned",
      extra: { route: "/issues/octocat/hello/9" },
    });
    expect(latestHandler).toHaveBeenCalledTimes(2);

    const sharedHandler = vi.fn();
    const disposeOlderGeneration = await registerAppNotificationClickHandler(sharedHandler);
    const disposeNewerGeneration = await registerAppNotificationClickHandler(sharedHandler);
    disposeOlderGeneration();
    registeredCallback({
      title: "Issue mentioned",
      extra: { route: "/issues/octocat/hello/10" },
    });
    expect(sharedHandler).toHaveBeenCalledWith("/issues/octocat/hello/10");

    disposeNewerGeneration();
    registeredCallback({
      title: "Issue mentioned",
      extra: { route: "/issues/octocat/hello/11" },
    });
    expect(sharedHandler).toHaveBeenCalledTimes(1);
  });
});
