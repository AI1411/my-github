import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  addWatchedRepository: (repo: string) => void;
  removeWatchedRepository: (repo: string) => void;
  setNotificationSetting: (key: keyof NotificationSettings, enabled: boolean) => void;
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
      }),
    },
  ),
);
