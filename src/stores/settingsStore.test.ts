import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  normalizeNotificationSettings,
  useSettingsStore,
} from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      watchedRepositories: [],
      notificationSettings: {
        enabled: true,
        ciFailures: "immediate",
        reviewRequests: "immediate",
        mentions: "immediate",
      },
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
      pinnedPullsByAccount: {},
    });
  });

  it("defaults to 60 second polling and enabled notifications", () => {
    const state = useSettingsStore.getState();

    expect(state.pollingInterval).toBe("60s");
    expect(state.notificationSettings.enabled).toBe(true);
  });

  it("adds and removes watched repositories without duplicates", () => {
    useSettingsStore.getState().addWatchedRepository("AI1411/my-github");
    useSettingsStore.getState().addWatchedRepository(" AI1411/my-github ");

    expect(useSettingsStore.getState().watchedRepositories).toEqual(["AI1411/my-github"]);

    useSettingsStore.getState().removeWatchedRepository("AI1411/my-github");

    expect(useSettingsStore.getState().watchedRepositories).toEqual([]);
  });

  it("updates notification settings and polling interval", () => {
    useSettingsStore.getState().setPollingInterval("5m");
    useSettingsStore.getState().setNotificationSetting("ciFailures", "off");

    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
    expect(useSettingsStore.getState().notificationSettings.ciFailures).toBe("off");
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

  it("persists settings to localStorage", () => {
    useSettingsStore.getState().setPollingInterval("30s");

    expect(localStorage.getItem("pulse-settings")).toContain("30s");
  });
});
