import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSavedSearch, type SavedSearch } from "../lib/advancedSearch";
import {
  DEFAULT_GITHUB_HOST,
  hostEntryFromBaseUrl,
  normalizeGithubWebBaseUrl,
  type GithubHost,
} from "../lib/githubHost";
import { pushRecent, type RecentPullRef } from "../lib/recentPulls";
import { DEFAULT_STALE_THRESHOLDS, type StaleThresholds } from "../lib/stalePulls";
import type { SavedFilter } from "../lib/savedFilters";
import { createWorkMode, normalizeWorkModes, type WorkMode } from "../lib/workModes";
import { DEFAULT_LOCAL_LLM, type LocalLlmSettings } from "../lib/localLlm";
import { normalizeRepoPathMap } from "../lib/openInEditor";
import { DEFAULT_QUIET_HOURS, normalizeQuietHours, type QuietHours } from "../lib/quietHours";

export type { RecentPullRef };
export type { GithubHost };
export type { WorkMode };
export type { LocalLlmSettings };
export type { QuietHours };

export type PollingInterval = "30s" | "60s" | "5m" | "off";
export type AppearanceDensity = "compact" | "comfortable";
export type AppearanceTheme = "dark" | "light" | "system";
export type AppearanceLayout = "inbox-first" | "pulls-first";
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
  | "shortcutHelp"
  | "listSearch"
  | "snooze"
  | "snoozeLast"
  | "nextQueue"
  | "syncNow";

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
  listSearch: { label: "Find in list", keys: "Cmd+F" },
  snooze: { label: "Snooze", keys: "H" },
  snoozeLast: { label: "Snooze last", keys: "Shift+H" },
  nextQueue: { label: "Next in review queue", keys: "]" },
  syncNow: { label: "Sync now", keys: "Cmd+R" },
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
  /** Known GitHub hosts (github.com + custom GHES). API routing uses host when set. */
  hosts: GithubHost[];
  /** Per-account web base URL (login → https://host). Defaults to github.com when absent. */
  accountHosts: Record<string, string>;
  setAccountHost: (login: string, hostUrl: string) => void;
  removeAccountHost: (login: string) => void;
  watchedRepositories: string[];
  notificationSettings: NotificationSettings;
  quietHours: QuietHours;
  setQuietHours: (patch: Partial<QuietHours>) => void;
  pollingInterval: PollingInterval;
  /**
   * Push-assisted sync (desktop MVP): not real GitHub webhooks.
   * When enabled, freshness relies on focus/resume revalidation
   * (`cmd_sync_now`) plus an optional shorter poll while focused.
   */
  pushSyncEnabled: boolean;
  dockBadgeEnabled: boolean;
  density: AppearanceDensity;
  theme: AppearanceTheme;
  layout: AppearanceLayout;
  shortcuts: Record<ShortcutId, ShortcutSetting>;
  staleThresholds: StaleThresholds;
  savedFilters: SavedFilter[];
  savedSearches: SavedSearch[];
  pinnedPullsByAccount: Record<string, PinnedPullRef[]>;
  recentPullsByAccount: Record<string, RecentPullRef[]>;
  repoNotificationRules: RepoNotificationRules;
  notificationRules: NotificationRule[];
  workModes: WorkMode[];
  activeWorkModeId: string | null;
  localLlm: LocalLlmSettings;
  setLocalLlm: (patch: Partial<LocalLlmSettings>) => void;
  /** owner/repo → absolute local clone path */
  repoLocalPaths: Record<string, string>;
  setRepoLocalPath: (repo: string, path: string) => void;
  removeRepoLocalPath: (repo: string) => void;
  preferWorktree: boolean;
  setPreferWorktree: (enabled: boolean) => void;
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
  addNotificationRule: (rule: Omit<NotificationRule, "id"> & { id?: string }) => void;
  updateNotificationRule: (
    id: string,
    patch: Partial<Pick<NotificationRule, "repo" | "kind" | "priority">>,
  ) => void;
  removeNotificationRule: (id: string) => void;
  addWorkMode: (name: string) => void;
  removeWorkMode: (id: string) => void;
  /** Apply mode snapshot; returns homePath for navigation. */
  activateWorkMode: (id: string) => string | null;
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
  setTheme: (theme: AppearanceTheme) => void;
  setLayout: (layout: AppearanceLayout) => void;
  setShortcut: (id: ShortcutId, keys: string) => void;
  resetShortcuts: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hosts: [DEFAULT_GITHUB_HOST],
      accountHosts: {},
      setAccountHost: (login, hostUrl) =>
        set((state) => {
          const trimmedLogin = login.trim();
          if (!trimmedLogin) return state;
          const web = normalizeGithubWebBaseUrl(hostUrl);
          const entry = hostEntryFromBaseUrl(web);
          const hosts = state.hosts.some((h) => h.id === entry.id)
            ? state.hosts
            : [...state.hosts, entry];
          return {
            hosts,
            accountHosts: {
              ...state.accountHosts,
              [trimmedLogin]: web,
            },
          };
        }),
      removeAccountHost: (login) =>
        set((state) => {
          const { [login]: _removed, ...rest } = state.accountHosts;
          return { accountHosts: rest };
        }),
      watchedRepositories: [],
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      quietHours: { ...DEFAULT_QUIET_HOURS },
      setQuietHours: (patch) =>
        set((state) => ({
          quietHours: { ...state.quietHours, ...patch },
        })),
      pollingInterval: "60s",
      pushSyncEnabled: false,
      dockBadgeEnabled: true,
      density: "comfortable",
      theme: "dark",
      layout: "inbox-first",
      shortcuts: DEFAULT_SHORTCUTS,
      staleThresholds: DEFAULT_STALE_THRESHOLDS,
      savedFilters: [],
      savedSearches: [],
      pinnedPullsByAccount: {},
      recentPullsByAccount: {},
      repoNotificationRules: {},
      notificationRules: [],
      workModes: [],
      activeWorkModeId: null,
      localLlm: { ...DEFAULT_LOCAL_LLM },
      setLocalLlm: (patch) =>
        set((state) => ({
          localLlm: { ...state.localLlm, ...patch },
        })),
      repoLocalPaths: {},
      setRepoLocalPath: (repo, path) =>
        set((state) => {
          const key = repo.trim();
          const value = path.trim();
          if (!key || !value) return state;
          return {
            repoLocalPaths: { ...state.repoLocalPaths, [key]: value },
          };
        }),
      removeRepoLocalPath: (repo) =>
        set((state) => {
          const { [repo]: _removed, ...rest } = state.repoLocalPaths;
          return { repoLocalPaths: rest };
        }),
      preferWorktree: true,
      setPreferWorktree: (enabled) => set({ preferWorktree: enabled }),
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
            const nextRepo = patch.repo !== undefined ? normalizeRepo(patch.repo) : rule.repo;
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
      addWorkMode: (name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return state;
          const mode = createWorkMode({
            name: trimmed,
            homePath: state.layout === "pulls-first" ? "/pulls" : "/inbox",
            watchedRepositories: [...state.watchedRepositories],
            notificationRules: state.notificationRules.map((r) => ({ ...r })),
            savedFilterIds: state.savedFilters.map((f) => f.id),
            notificationSettings: { ...state.notificationSettings },
          });
          return { workModes: [...state.workModes, mode] };
        }),
      removeWorkMode: (id) =>
        set((state) => ({
          workModes: state.workModes.filter((m) => m.id !== id),
          activeWorkModeId: state.activeWorkModeId === id ? null : state.activeWorkModeId,
        })),
      activateWorkMode: (id) => {
        const state = useSettingsStore.getState();
        const mode = state.workModes.find((m) => m.id === id);
        if (!mode) return null;
        set({
          activeWorkModeId: id,
          watchedRepositories: [...mode.watchedRepositories],
          notificationRules: mode.notificationRules.map((r) => ({ ...r })),
          notificationSettings: mode.notificationSettings
            ? {
                ...state.notificationSettings,
                ...mode.notificationSettings,
              }
            : state.notificationSettings,
        });
        return mode.homePath;
      },
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
            savedSearches: [...state.savedSearches, { ...payload, id: crypto.randomUUID() }],
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
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
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
        const hosts = Array.isArray(raw.hosts) && raw.hosts.length > 0 ? raw.hosts : current.hosts;
        const accountHosts =
          raw.accountHosts && typeof raw.accountHosts === "object"
            ? raw.accountHosts
            : current.accountHosts;
        const shortcuts = {
          ...DEFAULT_SHORTCUTS,
          ...(raw.shortcuts ?? {}),
        };
        for (const id of Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[]) {
          shortcuts[id] = {
            ...DEFAULT_SHORTCUTS[id],
            ...(raw.shortcuts?.[id] ?? {}),
            keys: raw.shortcuts?.[id]?.keys ?? DEFAULT_SHORTCUTS[id].keys,
            label: DEFAULT_SHORTCUTS[id].label,
          };
        }
        return {
          ...current,
          ...raw,
          hosts,
          accountHosts,
          shortcuts,
          notificationSettings: normalizeNotificationSettings(
            raw.notificationSettings ?? current.notificationSettings,
          ),
          quietHours: normalizeQuietHours(raw.quietHours ?? current.quietHours),
          notificationRules: normalizeNotificationRules(
            raw.notificationRules ?? current.notificationRules,
          ),
          workModes: normalizeWorkModes(raw.workModes ?? current.workModes),
          activeWorkModeId:
            typeof raw.activeWorkModeId === "string" || raw.activeWorkModeId === null
              ? (raw.activeWorkModeId as string | null)
              : current.activeWorkModeId,
          localLlm: {
            ...DEFAULT_LOCAL_LLM,
            ...(typeof raw.localLlm === "object" && raw.localLlm
              ? (raw.localLlm as Partial<LocalLlmSettings>)
              : {}),
          },
          repoLocalPaths: normalizeRepoPathMap(raw.repoLocalPaths ?? current.repoLocalPaths),
          preferWorktree:
            typeof raw.preferWorktree === "boolean" ? raw.preferWorktree : current.preferWorktree,
        };
      },
      partialize: (state) => ({
        hosts: state.hosts,
        accountHosts: state.accountHosts,
        watchedRepositories: state.watchedRepositories,
        notificationSettings: state.notificationSettings,
        quietHours: state.quietHours,
        pollingInterval: state.pollingInterval,
        pushSyncEnabled: state.pushSyncEnabled,
        dockBadgeEnabled: state.dockBadgeEnabled,
        density: state.density,
        theme: state.theme,
        layout: state.layout,
        shortcuts: state.shortcuts,
        staleThresholds: state.staleThresholds,
        savedFilters: state.savedFilters,
        savedSearches: state.savedSearches,
        pinnedPullsByAccount: state.pinnedPullsByAccount,
        recentPullsByAccount: state.recentPullsByAccount,
        repoNotificationRules: state.repoNotificationRules,
        notificationRules: state.notificationRules,
        workModes: state.workModes,
        activeWorkModeId: state.activeWorkModeId,
        localLlm: state.localLlm,
        repoLocalPaths: state.repoLocalPaths,
        preferWorktree: state.preferWorktree,
        releaseNotificationsEnabled: state.releaseNotificationsEnabled,
        digestAutoShowEnabled: state.digestAutoShowEnabled,
        shortcutChipsEnabled: state.shortcutChipsEnabled,
      }),
    },
  ),
);
