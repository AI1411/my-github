import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_STALE_THRESHOLDS, type StaleThresholds } from "../lib/stalePulls";
import type { SavedFilter } from "../lib/savedFilters";

export type PollingInterval = "30s" | "60s" | "5m" | "off";
export type AppearanceDensity = "compact" | "comfortable";
export type ShortcutId =
  | "commandPalette"
  | "workspaceSwitcher"
  | "listUp"
  | "listDown"
  | "openDetail"
  | "closeDetail"
  | "markRead"
  | "markAllRead"
  | "goInbox"
  | "goPulls"
  | "goSettings"
  | "shortcutHelp";

export interface ShortcutSetting {
  label: string;
  keys: string;
}

export interface NotificationSettings {
  enabled: boolean;
  ciFailures: boolean;
  reviewRequests: boolean;
  mentions: boolean;
}

/** リポジトリ単位の通知種類設定。未設定のリポジトリはグローバル設定に従う。 */
export interface RepoNotificationRule {
  ciFailures: boolean;
  reviewRequests: boolean;
  mentions: boolean;
}

export type RepoNotificationRules = Record<string, RepoNotificationRule>;

export const DEFAULT_REPO_NOTIFICATION_RULE: RepoNotificationRule = {
  ciFailures: true,
  reviewRequests: true,
  mentions: true,
};

export const DEFAULT_SHORTCUTS: Record<ShortcutId, ShortcutSetting> = {
  commandPalette: { label: "Command palette", keys: "Cmd+K" },
  workspaceSwitcher: { label: "Workspace switcher", keys: "Cmd+T" },
  listUp: { label: "Move up", keys: "K" },
  listDown: { label: "Move down", keys: "J" },
  openDetail: { label: "Open detail", keys: "Enter" },
  closeDetail: { label: "Close detail", keys: "Esc" },
  markRead: { label: "Mark read", keys: "X" },
  markAllRead: { label: "Mark all read", keys: "Shift+X" },
  goInbox: { label: "Go to Inbox", keys: "G then I" },
  goPulls: { label: "Go to Pulls", keys: "G then P" },
  goSettings: { label: "Go to Settings", keys: "G then S" },
  shortcutHelp: { label: "Shortcut help", keys: "?" },
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  ciFailures: true,
  reviewRequests: true,
  mentions: true,
};

function normalizeRepo(repo: string): string {
  return repo.trim();
}

export interface SettingsState {
  watchedRepositories: string[];
  notificationSettings: NotificationSettings;
  pollingInterval: PollingInterval;
  dockBadgeEnabled: boolean;
  density: AppearanceDensity;
  shortcuts: Record<ShortcutId, ShortcutSetting>;
  staleThresholds: StaleThresholds;
  savedFilters: SavedFilter[];
  repoNotificationRules: RepoNotificationRules;
  releaseNotificationsEnabled: boolean;
  setReleaseNotificationsEnabled: (enabled: boolean) => void;
  setRepoNotificationRule: (
    repo: string,
    key: keyof RepoNotificationRule,
    enabled: boolean,
  ) => void;
  addRepoNotificationRule: (repo: string) => void;
  removeRepoNotificationRule: (repo: string) => void;
  addWatchedRepository: (repo: string) => void;
  addSavedFilter: (filter: Omit<SavedFilter, "id">) => void;
  removeSavedFilter: (id: string) => void;
  removeWatchedRepository: (repo: string) => void;
  setNotificationSetting: (key: keyof NotificationSettings, enabled: boolean) => void;
  setStaleThreshold: (key: keyof StaleThresholds, days: number) => void;
  setPollingInterval: (interval: PollingInterval) => void;
  setDockBadgeEnabled: (enabled: boolean) => void;
  setDensity: (density: AppearanceDensity) => void;
  setShortcut: (id: ShortcutId, keys: string) => void;
  resetShortcuts: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      watchedRepositories: [],
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      pollingInterval: "60s",
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
      staleThresholds: DEFAULT_STALE_THRESHOLDS,
      savedFilters: [],
      repoNotificationRules: {},
      releaseNotificationsEnabled: true,
      setReleaseNotificationsEnabled: (enabled) => set({ releaseNotificationsEnabled: enabled }),
      setRepoNotificationRule: (repo, key, enabled) =>
        set((state) => {
          const current = state.repoNotificationRules[repo] ?? DEFAULT_REPO_NOTIFICATION_RULE;
          return {
            repoNotificationRules: {
              ...state.repoNotificationRules,
              [repo]: { ...current, [key]: enabled },
            },
          };
        }),
      addRepoNotificationRule: (repo) =>
        set((state) => {
          const normalized = normalizeRepo(repo);
          if (!normalized || state.repoNotificationRules[normalized]) return state;
          return {
            repoNotificationRules: {
              ...state.repoNotificationRules,
              [normalized]: DEFAULT_REPO_NOTIFICATION_RULE,
            },
          };
        }),
      removeRepoNotificationRule: (repo) =>
        set((state) => {
          const { [repo]: _removed, ...rest } = state.repoNotificationRules;
          return { repoNotificationRules: rest };
        }),
      addSavedFilter: (filter) =>
        set((state) => {
          const name = filter.name.trim();
          if (!name) return state;
          return {
            savedFilters: [...state.savedFilters, { ...filter, name, id: crypto.randomUUID() }],
          };
        }),
      removeSavedFilter: (id) =>
        set((state) => ({
          savedFilters: state.savedFilters.filter((filter) => filter.id !== id),
        })),
      addWatchedRepository: (repo) =>
        set((state) => {
          const normalized = normalizeRepo(repo);
          if (!normalized) return state;
          if (state.watchedRepositories.includes(normalized)) return state;
          return {
            watchedRepositories: [...state.watchedRepositories, normalized].sort(),
          };
        }),
      removeWatchedRepository: (repo) =>
        set((state) => ({
          watchedRepositories: state.watchedRepositories.filter(
            (item) => item !== normalizeRepo(repo),
          ),
        })),
      setNotificationSetting: (key, enabled) =>
        set((state) => ({
          notificationSettings: {
            ...state.notificationSettings,
            [key]: enabled,
          },
        })),
      setStaleThreshold: (key, days) =>
        set((state) => {
          if (!Number.isFinite(days) || days < 1) return state;
          return {
            staleThresholds: {
              ...state.staleThresholds,
              [key]: Math.floor(days),
            },
          };
        }),
      setPollingInterval: (interval) => set({ pollingInterval: interval }),
      setDockBadgeEnabled: (enabled) => set({ dockBadgeEnabled: enabled }),
      setDensity: (density) => set({ density }),
      setShortcut: (id, keys) =>
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [id]: {
              ...state.shortcuts[id],
              keys,
            },
          },
        })),
      resetShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS }),
    }),
    {
      name: "pulse-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        watchedRepositories: state.watchedRepositories,
        notificationSettings: state.notificationSettings,
        pollingInterval: state.pollingInterval,
        dockBadgeEnabled: state.dockBadgeEnabled,
        density: state.density,
        shortcuts: state.shortcuts,
        staleThresholds: state.staleThresholds,
        savedFilters: state.savedFilters,
        repoNotificationRules: state.repoNotificationRules,
        releaseNotificationsEnabled: state.releaseNotificationsEnabled,
      }),
    },
  ),
);
