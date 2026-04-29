import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS, useSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      watchedRepositories: [],
      notificationSettings: {
        enabled: true,
        ciFailures: true,
        reviewRequests: true,
        mentions: true,
      },
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
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

    expect(useSettingsStore.getState().watchedRepositories).toEqual([
      "AI1411/my-github",
    ]);

    useSettingsStore.getState().removeWatchedRepository("AI1411/my-github");

    expect(useSettingsStore.getState().watchedRepositories).toEqual([]);
  });

  it("updates notification settings and polling interval", () => {
    useSettingsStore.getState().setPollingInterval("5m");
    useSettingsStore.getState().setNotificationSetting("ciFailures", false);

    expect(useSettingsStore.getState().pollingInterval).toBe("5m");
    expect(useSettingsStore.getState().notificationSettings.ciFailures).toBe(
      false,
    );
  });

  it("customizes and resets shortcuts", () => {
    useSettingsStore.getState().setShortcut("commandPalette", "Ctrl+K");

    expect(useSettingsStore.getState().shortcuts.commandPalette.keys).toBe(
      "Ctrl+K",
    );

    useSettingsStore.getState().resetShortcuts();

    expect(useSettingsStore.getState().shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it("persists settings to localStorage", () => {
    useSettingsStore.getState().setPollingInterval("30s");

    expect(localStorage.getItem("pulse-settings")).toContain("30s");
  });
});
