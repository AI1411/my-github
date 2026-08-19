import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  normalizeNotificationRules,
  normalizeNotificationSettings,
  useSettingsStore,
} from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
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
      pinnedPullsByAccount: {},
      recentPullsByAccount: {},
      notificationRules: [],
      repoNotificationRules: {},
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
      watchOnboardingDismissed: false,
    });
  });

  it("defaults hosts to github.com and stores accountHosts", () => {
    const state = useSettingsStore.getState();
    expect(state.hosts).toEqual([
      { id: "github.com", baseUrl: "https://api.github.com", label: "github.com" },
    ]);
    expect(state.accountHosts).toEqual({});

    state.setAccountHost("octocat", "https://github.example.com");
    expect(useSettingsStore.getState().accountHosts.octocat).toBe("https://github.example.com");
    expect(useSettingsStore.getState().hosts.map((h) => h.id)).toContain("github.example.com");

    useSettingsStore.getState().removeAccountHost("octocat");
    expect(useSettingsStore.getState().accountHosts.octocat).toBeUndefined();
  });

  it("defaults to 60 second polling and enabled notifications", () => {
    const state = useSettingsStore.getState();

    expect(state.pollingInterval).toBe("60s");
    expect(state.notificationSettings.enabled).toBe(true);
    expect(state.quietHours).toEqual({
      enabled: false,
      start: "22:00",
      end: "08:00",
    });
  });

  it("adds and removes watched repositories without duplicates", () => {
    useSettingsStore.getState().addWatchedRepository("AI1411/my-github");
    useSettingsStore.getState().addWatchedRepository(" AI1411/my-github ");

    expect(useSettingsStore.getState().watchedRepositories).toEqual(["AI1411/my-github"]);

    useSettingsStore.getState().removeWatchedRepository("AI1411/my-github");

    expect(useSettingsStore.getState().watchedRepositories).toEqual([]);
  });

  it("dismisses first-run watch onboarding", () => {
    expect(useSettingsStore.getState().watchOnboardingDismissed).toBe(false);
    useSettingsStore.getState().setWatchOnboardingDismissed(true);
    expect(useSettingsStore.getState().watchOnboardingDismissed).toBe(true);
  });

  it("updates notification settings and polling interval", () => {
    useSettingsStore.getState().setPollingInterval("5m");
    useSettingsStore.getState().setNotificationSetting("ciFailures", "off");

    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
    expect(useSettingsStore.getState().notificationSettings.ciFailures).toBe("off");
  });

  it("updates quiet hours", () => {
    useSettingsStore.getState().setQuietHours({ enabled: true, start: "21:00", end: "07:00" });
    expect(useSettingsStore.getState().quietHours).toEqual({
      enabled: true,
      start: "21:00",
      end: "07:00",
    });
  });

  it("toggles push-assisted sync", () => {
    expect(useSettingsStore.getState().pushSyncEnabled).toBe(false);
    useSettingsStore.getState().setPushSyncEnabled(true);
    expect(useSettingsStore.getState().pushSyncEnabled).toBe(true);
  });

  it("migrates legacy boolean notification settings", () => {
    expect(
      normalizeNotificationSettings({
        enabled: true,
        ciFailures: true,
        reviewRequests: false,
        mentions: true,
      }),
    ).toEqual({
      enabled: true,
      ciFailures: "immediate",
      reviewRequests: "off",
      mentions: "immediate",
    });
  });

  it("normalizes notification rules and drops invalid entries", () => {
    expect(
      normalizeNotificationRules([
        { id: "ok", repo: "o/r", kind: "ciFailures", priority: "digest" },
        { repo: " ", kind: "mentions", priority: "off" },
        { id: "bad-kind", repo: "o/r", kind: "other", priority: "immediate" },
        { id: "bad-pri", repo: "o/r", kind: "mentions", priority: "loud" },
        null,
      ]),
    ).toEqual([{ id: "ok", repo: "o/r", kind: "ciFailures", priority: "digest" }]);
  });

  it("customizes and resets shortcuts", () => {
    useSettingsStore.getState().setShortcut("commandPalette", "Ctrl+K");

    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe("Ctrl+K");

    useSettingsStore.getState().resetShortcuts();

    expect(useSettingsStore.getState().shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it("pins and unpins pulls per account", () => {
    useSettingsStore.getState().togglePinnedPull("alice", "o/r", 1);
    useSettingsStore.getState().togglePinnedPull("alice", "o/r", 2);
    useSettingsStore.getState().togglePinnedPull("bob", "o/r", 1);

    expect(useSettingsStore.getState().pinnedPullsByAccount.alice).toEqual([
      { repo: "o/r", number: 1 },
      { repo: "o/r", number: 2 },
    ]);
    expect(useSettingsStore.getState().pinnedPullsByAccount.bob).toEqual([
      { repo: "o/r", number: 1 },
    ]);

    useSettingsStore.getState().togglePinnedPull("alice", "o/r", 1);

    expect(useSettingsStore.getState().pinnedPullsByAccount.alice).toEqual([
      { repo: "o/r", number: 2 },
    ]);
  });

  it("records recent pulls per account with newest first", () => {
    useSettingsStore.getState().recordRecentPull("alice", {
      repo: "o/r",
      number: 1,
      title: "First",
      openedAt: "2026-08-15T01:00:00.000Z",
    });
    useSettingsStore.getState().recordRecentPull("alice", {
      repo: "o/r",
      number: 2,
      title: "Second",
      openedAt: "2026-08-15T02:00:00.000Z",
    });
    useSettingsStore.getState().recordRecentPull("bob", {
      repo: "o/r",
      number: 1,
      title: "Bob PR",
      openedAt: "2026-08-15T03:00:00.000Z",
    });

    expect(useSettingsStore.getState().recentPullsByAccount.alice).toEqual([
      {
        repo: "o/r",
        number: 2,
        title: "Second",
        openedAt: "2026-08-15T02:00:00.000Z",
      },
      {
        repo: "o/r",
        number: 1,
        title: "First",
        openedAt: "2026-08-15T01:00:00.000Z",
      },
    ]);
    expect(useSettingsStore.getState().recentPullsByAccount.bob).toEqual([
      {
        repo: "o/r",
        number: 1,
        title: "Bob PR",
        openedAt: "2026-08-15T03:00:00.000Z",
      },
    ]);
  });

  it("persists settings to localStorage", () => {
    useSettingsStore.getState().setPollingInterval("30s");

    expect(localStorage.getItem("my-github-settings")).toContain("30s");
  });

  it("adds and removes saved searches without duplicate queries", () => {
    useSettingsStore.setState({ savedSearches: [] });
    useSettingsStore.getState().addSavedSearch("My reviews", "is:pr review-requested:@me");
    useSettingsStore.getState().addSavedSearch("Dup", "is:pr review-requested:@me");
    useSettingsStore.getState().addSavedSearch("  ", "is:issue");

    const searches = useSettingsStore.getState().savedSearches;
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({
      name: "My reviews",
      query: "is:pr review-requested:@me",
    });
    expect(searches[0].id).toBeTruthy();

    useSettingsStore.getState().removeSavedSearch(searches[0].id);
    expect(useSettingsStore.getState().savedSearches).toEqual([]);
  });

  it("adds, updates, and removes notification rules by repo × kind", () => {
    useSettingsStore.setState({ notificationRules: [] });
    useSettingsStore.getState().addNotificationRule({
      repo: " octocat/hello ",
      kind: "ciFailures",
      priority: "digest",
    });
    useSettingsStore.getState().addNotificationRule({
      repo: "octocat/hello",
      kind: "ciFailures",
      priority: "off",
    });
    useSettingsStore.getState().addNotificationRule({
      repo: "octocat/hello",
      kind: "mentions",
      priority: "immediate",
    });

    const rules = useSettingsStore.getState().notificationRules;
    expect(rules).toHaveLength(2);
    expect(rules.find((rule) => rule.kind === "ciFailures")).toMatchObject({
      repo: "octocat/hello",
      priority: "off",
    });

    const mentions = rules.find((rule) => rule.kind === "mentions");
    expect(mentions).toBeTruthy();
    useSettingsStore.getState().updateNotificationRule(mentions!.id, {
      priority: "digest",
    });
    expect(
      useSettingsStore.getState().notificationRules.find((rule) => rule.id === mentions!.id)
        ?.priority,
    ).toBe("digest");

    useSettingsStore.getState().removeNotificationRule(mentions!.id);
    expect(useSettingsStore.getState().notificationRules).toHaveLength(1);
  });
});
