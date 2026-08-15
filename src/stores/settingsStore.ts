import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSavedSearch, type SavedSearch } from "../lib/advancedSearch";
import { pushRecent, type RecentPullRef } from "../lib/recentPulls";
import { DEFAULT_STALE_THRESHOLDS, type StaleThresholds } from "../lib/stalePulls";
import type { SavedFilter } from "../lib/savedFilters";

export type { RecentPullRef };

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

export type NotificationDelivery = "immediate" | "digest" | "off";

export interface NotificationSettings {
  enabled: boolean;
  ciFailures: NotificationDelivery;
  reviewRequests: NotificationDelivery;
  mentions: NotificationDelivery;
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

/** repo × kind × priority の自動ルール（Issue #239）。 */
export type NotificationRuleKind = "ciFailures" | "reviewRequests" | "mentions";

export interface NotificationRule {
  id: string;
  repo: string;
  kind: NotificationRuleKind;
  priority: NotificationDelivery;
}

export function normalizeNotificationRules(raw: unknown): NotificationRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: NotificationRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const repo = typeof source.repo === "string" ? source.repo.trim() : "";
    const kind = source.kind;
    const priority = source.priority;
    if (!repo) continue;
    if (kind !== "ciFailures" && kind !== "reviewRequests" && kind !== "mentions") continue;
    if (priority !== "immediate" && priority !== "digest" && priority !== "off") continue;
    rules.push({
      id: typeof source.id === "string" && source.id ? source.id : crypto.randomUUID(),
      repo,
      kind,
      priority,
    });
  }
  return rules;
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
  ciFailures: "immediate",
  reviewRequests: "immediate",
  mentions: "digest",
};

function coerceDelivery(value: unknown, fallback: NotificationDelivery): NotificationDelivery {
  if (value === "immediate" || value === "digest" || value === "off") return value;
  if (value === true) return "immediate";
  if (value === false) return "off";
  return fallback;
}

export function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    ciFailures: coerceDelivery(source.ciFailures, "immediate"),
    reviewRequests: coerceDelivery(source.reviewRequests, "immediate"),
    mentions: coerceDelivery(source.mentions, "digest"),
  };
}

function normalizeRepo(repo: string): string {
  return repo.trim();
}

export interface PinnedPullRef {
  repo: string;
  number: number;
}

export interface SettingsState {
  watchedRepositories: string[];
  notificationSettings: NotificationSettings;
  pollingInterval: PollingInterval;
  /**
   * Push-assisted sync (desktop MVP): not real GitHub webhooks.
   * When enabled, freshness relies on focus/resume revalidation
   * (`cmd_sync_now`) plus an optional shorter poll while focused.
   */
  pushSyncEnabled: boolean;
  dockBadgeEnabled: boolean;
  density: AppearanceDensity;
  shortcuts: Record<ShortcutId, ShortcutSetting>;
  staleThresholds: StaleThresholds;
  savedFilters: SavedFilter[];
  savedSearches: SavedSearch[];
  pinnedPullsByAccount: Record<string, PinnedPullRef[]>;
  recentPullsByAccount: Record<string, RecentPullRef[]>;
  repoNotificationRules: RepoNotificationRules;
  notificationRules: NotificationRule[];
  releaseNotificationsEnabled: boolean;
  setReleaseNotificationsEnabled: (enabled: boolean) => void;
  digestAutoShowEnabled: boolean;
  setDigestAutoShowEnabled: (enabled: boolean) => void;
  shortcutChipsEnabled: boolean;
  setShortcutChipsEnabled: (enabled: boolean) => void;
  togglePinnedPull: (accountId: string, repo: string, number: number) => void;
  recordRecentPull: (
    accountId: string,
    entry: Omit<RecentPullRef, "openedAt"> & { openedAt?: string },
  ) => void;
  setRepoNotificationRule: (
    repo: string,
    key: keyof RepoNotificationRule,
    enabled: boolean,
  ) => void;
  addRepoNotificationRule: (repo: string) => void;
  removeRepoNotificationRule: (repo: string) => void;
  addNotificationRule: (
    rule: Omit<NotificationRule, "id"> & { id?: string },
  ) => void;
  updateNotificationRule: (
    id: string,
    patch: Partial<Pick<NotificationRule, "repo" | "kind" | "priority">>,
  ) => void;
  removeNotificationRule: (id: string) => void;
  addWatchedRepository: (repo: string) => void;
  addSavedFilter: (filter: Omit<SavedFilter, "id">) => void;
  removeSavedFilter: (id: string) => void;
  renameSavedFilter: (id: string, name: string) => void;
  addSavedSearch: (name: string, query: string) => void;
  removeSavedSearch: (id: string) => void;
  removeWatchedRepository: (repo: string) => void;
  setNotificationSetting: (
    key: keyof NotificationSettings,
    value: boolean | NotificationDelivery,
  ) => void;
  setStaleThreshold: (key: keyof StaleThresholds, days: number) => void;
  setPollingInterval: (interval: PollingInterval) => void;
  setPushSyncEnabled: (enabled: boolean) => void;
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
      pushSyncEnabled: false,
      dockBadgeEnabled: true,
      density: "comfortable",
      shortcuts: DEFAULT_SHORTCUTS,
      staleThresholds: DEFAULT_STALE_THRESHOLDS,
      savedFilters: [],
      savedSearches: [],
      pinnedPullsByAccount: {},
      recentPullsByAccount: {},
      repoNotificationRules: {},
      notificationRules: [],
      releaseNotificationsEnabled: true,
      setReleaseNotificationsEnabled: (enabled) => set({ releaseNotificationsEnabled: enabled }),
      digestAutoShowEnabled: true,
      setDigestAutoShowEnabled: (enabled) => set({ digestAutoShowEnabled: enabled }),
      shortcutChipsEnabled: true,
      setShortcutChipsEnabled: (enabled) => set({ shortcutChipsEnabled: enabled }),
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
      addNotificationRule: (rule) =>
        set((state) => {
          const repo = normalizeRepo(rule.repo);
          if (!repo) return state;
          if (
            state.notificationRules.some(
              (existing) => existing.repo === repo && existing.kind === rule.kind,
            )
          ) {
            return {
              notificationRules: state.notificationRules.map((existing) =>
                existing.repo === repo && existing.kind === rule.kind
                  ? { ...existing, priority: rule.priority }
                  : existing,
              ),
            };
          }
          return {
            notificationRules: [
              ...state.notificationRules,
              {
                id: rule.id ?? crypto.randomUUID(),
                repo,
                kind: rule.kind,
                priority: rule.priority,
              },
            ],
          };
        }),
      updateNotificationRule: (id, patch) =>
        set((state) => ({
          notificationRules: state.notificationRules.map((rule) => {
            if (rule.id !== id) return rule;
            const nextRepo =
              patch.repo !== undefined ? normalizeRepo(patch.repo) : rule.repo;
            if (!nextRepo) return rule;
            return {
              ...rule,
              repo: nextRepo,
              kind: patch.kind ?? rule.kind,
              priority: patch.priority ?? rule.priority,
            };
          }),
        })),
      removeNotificationRule: (id) =>
        set((state) => ({
          notificationRules: state.notificationRules.filter((rule) => rule.id !== id),
        })),
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
      renameSavedFilter: (id, name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return state;
          return {
            savedFilters: state.savedFilters.map((filter) =>
              filter.id === id ? { ...filter, name: trimmed } : filter,
            ),
          };
        }),
      addSavedSearch: (name, query) =>
        set((state) => {
          const payload = createSavedSearch(name, query);
          if (!payload) return state;
          if (state.savedSearches.some((s) => s.query === payload.query)) return state;
          return {
            savedSearches: [
              ...state.savedSearches,
              { ...payload, id: crypto.randomUUID() },
            ],
          };
        }),
      removeSavedSearch: (id) =>
        set((state) => ({
          savedSearches: state.savedSearches.filter((search) => search.id !== id),
        })),
      togglePinnedPull: (accountId, repo, number) =>
        set((state) => {
          if (!accountId || !repo || !Number.isFinite(number)) return state;
          const current = state.pinnedPullsByAccount[accountId] ?? [];
          const exists = current.some((pin) => pin.repo === repo && pin.number === number);
          const next = exists
            ? current.filter((pin) => !(pin.repo === repo && pin.number === number))
            : [...current, { repo, number }];
          return {
            pinnedPullsByAccount: {
              ...state.pinnedPullsByAccount,
              [accountId]: next,
            },
          };
        }),
      recordRecentPull: (accountId, entry) =>
        set((state) => {
          if (!accountId) return state;
          const current = state.recentPullsByAccount[accountId] ?? [];
          const next = pushRecent(current, {
            repo: entry.repo,
            number: entry.number,
            title: entry.title,
            openedAt: entry.openedAt ?? new Date().toISOString(),
          });
          return {
            recentPullsByAccount: {
              ...state.recentPullsByAccount,
              [accountId]: next,
            },
          };
        }),
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
      setNotificationSetting: (key, value) =>
        set((state) => ({
          notificationSettings: {
            ...state.notificationSettings,
            [key]: key === "enabled" ? Boolean(value) : coerceDelivery(value, "off"),
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
      setPushSyncEnabled: (enabled) => set({ pushSyncEnabled: enabled }),
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
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...raw,
          notificationSettings: normalizeNotificationSettings(
            raw.notificationSettings ?? current.notificationSettings,
          ),
          notificationRules: normalizeNotificationRules(
            raw.notificationRules ?? current.notificationRules,
          ),
        };
      },
      partialize: (state) => ({
        watchedRepositories: state.watchedRepositories,
        notificationSettings: state.notificationSettings,
        pollingInterval: state.pollingInterval,
        pushSyncEnabled: state.pushSyncEnabled,
        dockBadgeEnabled: state.dockBadgeEnabled,
        density: state.density,
        shortcuts: state.shortcuts,
        staleThresholds: state.staleThresholds,
        savedFilters: state.savedFilters,
        savedSearches: state.savedSearches,
        pinnedPullsByAccount: state.pinnedPullsByAccount,
        recentPullsByAccount: state.recentPullsByAccount,
        repoNotificationRules: state.repoNotificationRules,
        notificationRules: state.notificationRules,
        releaseNotificationsEnabled: state.releaseNotificationsEnabled,
        digestAutoShowEnabled: state.digestAutoShowEnabled,
        shortcutChipsEnabled: state.shortcutChipsEnabled,
      }),
    },
  ),
);
