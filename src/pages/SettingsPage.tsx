import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import packageJson from "../../package.json";
import { Tabs } from "../components/common/Tabs";
import { Toolbar } from "../components/common/Toolbar";
import { useRepoSearchQuery } from "../features/settings/useRepoSearchQuery";
import { hostDisplayLabel } from "../lib/githubHost";
import {
  displayShortcutKeys,
  findShortcutConflicts,
  formatShortcutEvent,
} from "../lib/shortcutKeys";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import {
  DEFAULT_SHORTCUTS,
  useSettingsStore,
  type NotificationDelivery,
  type NotificationRuleKind,
  type PollingInterval,
  type ShortcutId,
} from "../stores/settingsStore";
import { AboutLicensesSection } from "../components/settings/AboutLicensesSection";
import { AppearanceSettingsSection } from "../components/settings/AppearanceSettingsSection";
import {
  InlineButton,
  Row,
  Section,
  Toggle,
  sectionStyle,
} from "../components/settings/settingsUi";
import { PATTab } from "./components/PATTab";

type SettingsTab =
  | "accounts"
  | "repositories"
  | "notifications"
  | "appearance"
  | "shortcuts"
  | "about";

interface RateLimitInfo {
  remaining: number;
  reset: number;
}

interface SyncStatusResult {
  lastRateLimit?: RateLimitInfo | null;
  last_rate_limit?: RateLimitInfo | null;
}

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "accounts", label: "Accounts" },
  { id: "repositories", label: "Repositories" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

const POLLING_OPTIONS: { id: PollingInterval; label: string }[] = [
  { id: "30s", label: "30 sec" },
  { id: "60s", label: "60 sec" },
  { id: "5m", label: "5 min" },
  { id: "off", label: "Off" },
];

const SHORTCUT_IDS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[];

function formatReset(epochSeconds: number): string {
  if (!epochSeconds) return "unknown";
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("accounts");
  const [addingAccount, setAddingAccount] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateLimitLoaded, setRateLimitLoaded] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const pulls = useDataStore((state) => state.pulls);
  const issues = useDataStore((state) => state.issues);
  const notifications = useDataStore((state) => state.notifications);
  const accountHosts = useSettingsStore((state) => state.accountHosts);
  const setAccountHost = useSettingsStore((state) => state.setAccountHost);
  const removeAccountHost = useSettingsStore((state) => state.removeAccountHost);
  const watchedRepositories = useSettingsStore((state) => state.watchedRepositories);
  const notificationSettings = useSettingsStore((state) => state.notificationSettings);
  const quietHours = useSettingsStore((state) => state.quietHours);
  const setQuietHours = useSettingsStore((state) => state.setQuietHours);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const pushSyncEnabled = useSettingsStore((state) => state.pushSyncEnabled);
  const setPushSyncEnabled = useSettingsStore((state) => state.setPushSyncEnabled);
  const dockBadgeEnabled = useSettingsStore((state) => state.dockBadgeEnabled);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const addWatchedRepository = useSettingsStore((state) => state.addWatchedRepository);
  const removeWatchedRepository = useSettingsStore((state) => state.removeWatchedRepository);
  const setNotificationSetting = useSettingsStore((state) => state.setNotificationSetting);
  const staleThresholds = useSettingsStore((state) => state.staleThresholds);
  const setStaleThreshold = useSettingsStore((state) => state.setStaleThreshold);
  const notificationRules = useSettingsStore((state) => state.notificationRules);
  const addNotificationRule = useSettingsStore((state) => state.addNotificationRule);
  const updateNotificationRule = useSettingsStore((state) => state.updateNotificationRule);
  const removeNotificationRule = useSettingsStore((state) => state.removeNotificationRule);
  const [ruleRepoInput, setRuleRepoInput] = useState("");
  const [ruleKindInput, setRuleKindInput] = useState<NotificationRuleKind>("ciFailures");
  const [rulePriorityInput, setRulePriorityInput] = useState<NotificationDelivery>("immediate");
  const releaseNotificationsEnabled = useSettingsStore(
    (state) => state.releaseNotificationsEnabled,
  );
  const setReleaseNotificationsEnabled = useSettingsStore(
    (state) => state.setReleaseNotificationsEnabled,
  );
  const digestAutoShowEnabled = useSettingsStore((state) => state.digestAutoShowEnabled);
  const setDigestAutoShowEnabled = useSettingsStore((state) => state.setDigestAutoShowEnabled);
  const setPollingInterval = useSettingsStore((state) => state.setPollingInterval);
  const setDockBadgeEnabled = useSettingsStore((state) => state.setDockBadgeEnabled);
  const setShortcut = useSettingsStore((state) => state.setShortcut);
  const resetShortcuts = useSettingsStore((state) => state.resetShortcuts);
  const shortcutChipsEnabled = useSettingsStore((state) => state.shortcutChipsEnabled);
  const setShortcutChipsEnabled = useSettingsStore((state) => state.setShortcutChipsEnabled);
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);
  const shortcutConflicts = useMemo(() => findShortcutConflicts(shortcuts), [shortcuts]);
  const workModes = useSettingsStore((state) => state.workModes);
  const activeWorkModeId = useSettingsStore((state) => state.activeWorkModeId);
  const addWorkMode = useSettingsStore((state) => state.addWorkMode);
  const removeWorkMode = useSettingsStore((state) => state.removeWorkMode);
  const activateWorkMode = useSettingsStore((state) => state.activateWorkMode);
  const [workModeName, setWorkModeName] = useState("");
  const localLlm = useSettingsStore((state) => state.localLlm);
  const setLocalLlm = useSettingsStore((state) => state.setLocalLlm);
  const repoLocalPaths = useSettingsStore((state) => state.repoLocalPaths);
  const setRepoLocalPath = useSettingsStore((state) => state.setRepoLocalPath);
  const removeRepoLocalPath = useSettingsStore((state) => state.removeRepoLocalPath);
  const preferWorktree = useSettingsStore((state) => state.preferWorktree);
  const setPreferWorktree = useSettingsStore((state) => state.setPreferWorktree);
  const [pathRepoInput, setPathRepoInput] = useState("");
  const [pathDirInput, setPathDirInput] = useState("");

  const repoSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...pulls.map((pull) => pull.repo),
          ...issues.map((issue) => issue.repo),
          ...notifications.map((notification) => notification.repo),
        ]),
      ).sort(),
    [pulls, issues, notifications],
  );

  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoHighlightIndex, setRepoHighlightIndex] = useState(-1);
  const {
    results: repoSearchResults,
    loading: repoSearchLoading,
    error: repoSearchError,
  } = useRepoSearchQuery(repoInput);
  const repoSearchCandidates = useMemo(
    () => repoSearchResults.filter((result) => !watchedRepositories.includes(result.fullName)),
    [repoSearchResults, watchedRepositories],
  );

  useEffect(() => {
    setRepoHighlightIndex(-1);
    setRepoDropdownOpen(repoInput.trim().length >= 2);
  }, [repoInput]);

  const handleSelectRepoCandidate = (fullName: string) => {
    addWatchedRepository(fullName);
    setRepoInput("");
    setRepoDropdownOpen(false);
    setRepoHighlightIndex(-1);
  };

  const handleRepoInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setRepoDropdownOpen(false);
      setRepoHighlightIndex(-1);
      return;
    }
    if (!repoDropdownOpen || repoSearchCandidates.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setRepoHighlightIndex((index) => (index + 1) % repoSearchCandidates.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setRepoHighlightIndex((index) => (index <= 0 ? repoSearchCandidates.length : index) - 1);
    } else if (event.key === "Enter" && repoHighlightIndex >= 0) {
      event.preventDefault();
      handleSelectRepoCandidate(repoSearchCandidates[repoHighlightIndex].fullName);
    }
  };

  useEffect(() => {
    if (activeTab !== "about") return;
    let cancelled = false;
    setRateError(null);
    setRateLimitLoaded(false);
    invoke<SyncStatusResult>("cmd_get_sync_status")
      .then((result) => {
        if (cancelled) return;
        setRateLimit(result.lastRateLimit ?? result.last_rate_limit ?? null);
        setRateLimitLoaded(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRateError(String(error));
          setRateLimitLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleAddRepository = () => {
    addWatchedRepository(repoInput);
    setRepoInput("");
  };

  const handleRemoveAccount = async () => {
    if (!user) return;
    await invoke("cmd_logout", { accountId: user.login });
    removeAccountHost(user.login);
  };

  const activeHostLabel = hostDisplayLabel(user ? accountHosts[user.login] : undefined);

  return (
    <div className="flex h-full flex-col">
      <Toolbar title="Settings" subtitle="my-github v0.1.0" />
      <Tabs
        items={SETTINGS_TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "accounts" && (
          <Section
            title="Accounts"
            action={
              <InlineButton onClick={() => setAddingAccount((v) => !v)}>
                {addingAccount ? "Cancel" : "Add account"}
              </InlineButton>
            }
          >
            <Row label="Active account">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="truncate block">{user?.login ?? "Not signed in"}</span>
                  {user && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                      data-testid="active-account-host"
                    >
                      {activeHostLabel}
                    </span>
                  )}
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Active
                </span>
              </div>
            </Row>
            <Row label="Actions">
              <div className="flex flex-wrap gap-2">
                <InlineButton>Reauth</InlineButton>
                <InlineButton onClick={() => void handleRemoveAccount()}>Remove</InlineButton>
              </div>
            </Row>
            {addingAccount && (
              <Row label="Add with PAT">
                <div className="max-w-md">
                  <PATTab
                    onSuccess={(nextUser, hostWebBase) => {
                      setAccountHost(nextUser.login, hostWebBase);
                      setUser(nextUser);
                      setAddingAccount(false);
                    }}
                  />
                </div>
              </Row>
            )}
          </Section>
        )}

        {activeTab === "repositories" && (
          <Section title="Watched repositories">
            <form
              className="mb-4 flex max-w-2xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddRepository();
              }}
            >
              <label className="sr-only" htmlFor="repository-full-name">
                Repository full name
              </label>
              <div className="relative min-w-0 flex-1">
                <input
                  id="repository-full-name"
                  value={repoInput}
                  onChange={(event) => setRepoInput(event.currentTarget.value)}
                  onKeyDown={handleRepoInputKeyDown}
                  onFocus={() => {
                    if (repoInput.trim().length >= 2) setRepoDropdownOpen(true);
                  }}
                  onBlur={() => setRepoDropdownOpen(false)}
                  placeholder="owner/repository"
                  role="combobox"
                  aria-expanded={repoDropdownOpen}
                  aria-controls="repo-search-listbox"
                  aria-autocomplete="list"
                  autoComplete="off"
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
                {repoDropdownOpen && (
                  <ul
                    id="repo-search-listbox"
                    role="listbox"
                    aria-label="Repository suggestions"
                    className="absolute z-10 mt-1 w-full overflow-hidden rounded-md text-sm shadow-lg"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {repoSearchLoading && (
                      <li className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                        Searching…
                      </li>
                    )}
                    {!repoSearchLoading && repoSearchError && (
                      <li className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                        Search failed: {repoSearchError}
                      </li>
                    )}
                    {!repoSearchLoading &&
                      !repoSearchError &&
                      repoSearchCandidates.length === 0 && (
                        <li className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                          No matching repositories
                        </li>
                      )}
                    {!repoSearchLoading &&
                      repoSearchCandidates.map((candidate, index) => (
                        <li
                          key={candidate.fullName}
                          role="option"
                          aria-selected={index === repoHighlightIndex}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2"
                          style={{
                            backgroundColor:
                              index === repoHighlightIndex ? "var(--bg-tertiary)" : undefined,
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectRepoCandidate(candidate.fullName);
                          }}
                          onMouseEnter={() => setRepoHighlightIndex(index)}
                        >
                          <span className="flex-shrink-0 truncate">{candidate.fullName}</span>
                          {candidate.private && (
                            <span
                              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: "var(--bg-tertiary)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              Private
                            </span>
                          )}
                          {candidate.description && (
                            <span className="truncate" style={{ color: "var(--text-muted)" }}>
                              {candidate.description}
                            </span>
                          )}
                          <span
                            className="ml-auto flex-shrink-0 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            ★ {candidate.stars}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <InlineButton onClick={handleAddRepository}>Add repository</InlineButton>
            </form>
            <div className="divide-y" style={sectionStyle()}>
              {watchedRepositories.length === 0 ? (
                <p className="py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  No watched repositories
                </p>
              ) : (
                watchedRepositories.map((repo) => (
                  <div key={repo} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="truncate text-sm">{repo}</span>
                    <InlineButton
                      ariaLabel={`Remove ${repo}`}
                      onClick={() => removeWatchedRepository(repo)}
                    >
                      Remove
                    </InlineButton>
                  </div>
                ))
              )}
            </div>
            {repoSuggestions.length > 0 && (
              <Row label="Recent repositories">
                <div className="flex flex-wrap gap-2">
                  {repoSuggestions.slice(0, 8).map((repo) => (
                    <InlineButton key={repo} onClick={() => addWatchedRepository(repo)}>
                      {repo}
                    </InlineButton>
                  ))}
                </div>
              </Row>
            )}
          </Section>
        )}

        {activeTab === "repositories" && (
          <Section title="Work modes">
            <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
              Snapshot watched repos, notification rules, and home route. Switch via ⌘T / ⌘K.
            </p>
            <form
              className="mb-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addWorkMode(workModeName);
                setWorkModeName("");
              }}
            >
              <input
                aria-label="New work mode name"
                value={workModeName}
                onChange={(event) => setWorkModeName(event.target.value)}
                placeholder="e.g. Work / Personal"
                className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
              <InlineButton
                onClick={() => {
                  addWorkMode(workModeName);
                  setWorkModeName("");
                }}
              >
                Save current as mode
              </InlineButton>
            </form>
            <div className="divide-y" style={sectionStyle()}>
              {workModes.length === 0 ? (
                <p className="py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  No work modes yet
                </p>
              ) : (
                workModes.map((mode) => (
                  <div
                    key={mode.id}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm" style={{ color: "var(--text-primary)" }}>
                        {mode.name}
                        {activeWorkModeId === mode.id ? " · active" : ""}
                      </div>
                      <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {mode.watchedRepositories.length} repos · {mode.notificationRules.length}{" "}
                        rules · {mode.homePath}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <InlineButton
                        active={activeWorkModeId === mode.id}
                        onClick={() => {
                          const path = activateWorkMode(mode.id);
                          if (path) navigate(path);
                        }}
                      >
                        Activate
                      </InlineButton>
                      <InlineButton
                        ariaLabel={`Remove ${mode.name}`}
                        onClick={() => removeWorkMode(mode.id)}
                      >
                        Remove
                      </InlineButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>
        )}

        {activeTab === "repositories" && (
          <Section title="Local clones (Open in editor)">
            <Row label="Worktree">
              <Toggle
                checked={preferWorktree}
                label="Prefer git worktree for PR branches"
                onChange={setPreferWorktree}
              />
            </Row>
            <form
              className="mb-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setRepoLocalPath(pathRepoInput, pathDirInput);
                setPathRepoInput("");
                setPathDirInput("");
              }}
            >
              <input
                aria-label="Repo for local path"
                value={pathRepoInput}
                onChange={(event) => setPathRepoInput(event.target.value)}
                placeholder="owner/repo"
                className="min-w-[10rem] flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
              <input
                aria-label="Local clone path"
                value={pathDirInput}
                onChange={(event) => setPathDirInput(event.target.value)}
                placeholder="/path/to/clone"
                className="min-w-[14rem] flex-[2] rounded-md px-3 py-2 font-mono text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
              <InlineButton
                onClick={() => {
                  setRepoLocalPath(pathRepoInput, pathDirInput);
                  setPathRepoInput("");
                  setPathDirInput("");
                }}
              >
                Save path
              </InlineButton>
            </form>
            <div className="divide-y" style={sectionStyle()}>
              {Object.keys(repoLocalPaths).length === 0 ? (
                <p className="py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  No local paths mapped
                </p>
              ) : (
                Object.entries(repoLocalPaths).map(([repo, path]) => (
                  <div key={repo} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{repo}</div>
                      <div
                        className="truncate font-mono text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {path}
                      </div>
                    </div>
                    <InlineButton
                      ariaLabel={`Remove path for ${repo}`}
                      onClick={() => removeRepoLocalPath(repo)}
                    >
                      Remove
                    </InlineButton>
                  </div>
                ))
              )}
            </div>
          </Section>
        )}

        {activeTab === "notifications" && (
          <Section title="Notifications">
            <Row label="Polling interval">
              <div className="flex flex-wrap gap-2">
                {POLLING_OPTIONS.map((option) => (
                  <InlineButton
                    key={option.id}
                    active={pollingInterval === option.id}
                    onClick={() => setPollingInterval(option.id)}
                  >
                    {option.label}
                  </InlineButton>
                ))}
              </div>
            </Row>
            <Row label="Push-assisted sync">
              <div className="flex flex-col gap-2">
                <Toggle
                  checked={pushSyncEnabled}
                  label="Enable push-assisted sync"
                  onChange={setPushSyncEnabled}
                />
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Desktop apps cannot host a durable public GitHub webhook. When enabled, this mode
                  relies on sync-on-focus/resume (<code>cmd_sync_now</code>) plus a shorter poll
                  (30s) while the window is focused — not inbound webhooks.
                </p>
              </div>
            </Row>
            <Row label="OS notifications">
              <Toggle
                checked={notificationSettings.enabled}
                label="Enabled"
                onChange={(checked) => setNotificationSetting("enabled", checked)}
              />
            </Row>
            <Row label="Notification types">
              <div className="flex flex-col gap-3">
                {(
                  [
                    ["ciFailures", "CI failures"],
                    ["reviewRequests", "Review requests"],
                    ["mentions", "Mentions"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-4 text-sm">
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <select
                      aria-label={`${label} delivery`}
                      value={notificationSettings[key]}
                      onChange={(event) =>
                        setNotificationSetting(
                          key,
                          event.currentTarget.value as "immediate" | "digest" | "off",
                        )
                      }
                      className="rounded-md px-2 py-1 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="immediate">Immediate</option>
                      <option value="digest">Digest</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                ))}
                <Toggle
                  checked={releaseNotificationsEnabled}
                  label="Releases"
                  onChange={setReleaseNotificationsEnabled}
                />
              </div>
            </Row>
            <Row label="Dock badge">
              <Toggle
                checked={dockBadgeEnabled}
                label="Unread count"
                onChange={setDockBadgeEnabled}
              />
            </Row>
            <Row label="Quiet hours">
              <div className="flex flex-col gap-3">
                <Toggle
                  checked={quietHours.enabled}
                  label="Skip OS notifications during quiet hours"
                  onChange={(enabled) => setQuietHours({ enabled })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Start
                    <input
                      type="time"
                      aria-label="Quiet hours start"
                      value={quietHours.start}
                      disabled={!quietHours.enabled}
                      onChange={(event) => setQuietHours({ start: event.currentTarget.value })}
                      className="rounded-md px-2 py-1 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                  <label
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    End
                    <input
                      type="time"
                      aria-label="Quiet hours end"
                      value={quietHours.end}
                      disabled={!quietHours.enabled}
                      onChange={(event) => setQuietHours({ end: event.currentTarget.value })}
                      className="rounded-md px-2 py-1 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                </div>
              </div>
            </Row>
            <Row label="Startup digest">
              <Toggle
                checked={digestAutoShowEnabled}
                label="Show digest when returning after 6+ hours"
                onChange={setDigestAutoShowEnabled}
              />
            </Row>
            <Row label="Notification rules">
              <div className="flex flex-col gap-2">
                <form
                  className="flex max-w-2xl flex-wrap items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addNotificationRule({
                      repo: ruleRepoInput,
                      kind: ruleKindInput,
                      priority: rulePriorityInput,
                    });
                    setRuleRepoInput("");
                  }}
                >
                  <input
                    aria-label="Repository for notification rule"
                    value={ruleRepoInput}
                    onChange={(event) => setRuleRepoInput(event.currentTarget.value)}
                    placeholder="owner/repository"
                    list="rule-repo-suggestions"
                    className="min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <datalist id="rule-repo-suggestions">
                    {watchedRepositories.map((repo) => (
                      <option key={repo} value={repo} />
                    ))}
                  </datalist>
                  <select
                    aria-label="Notification kind"
                    value={ruleKindInput}
                    onChange={(event) =>
                      setRuleKindInput(event.currentTarget.value as NotificationRuleKind)
                    }
                    className="rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="ciFailures">CI failures</option>
                    <option value="reviewRequests">Review requests</option>
                    <option value="mentions">Mentions</option>
                  </select>
                  <select
                    aria-label="Notification priority"
                    value={rulePriorityInput}
                    onChange={(event) =>
                      setRulePriorityInput(event.currentTarget.value as NotificationDelivery)
                    }
                    className="rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="immediate">Immediate</option>
                    <option value="digest">Digest</option>
                    <option value="off">Off</option>
                  </select>
                  <InlineButton
                    onClick={() => {
                      addNotificationRule({
                        repo: ruleRepoInput,
                        kind: ruleKindInput,
                        priority: rulePriorityInput,
                      });
                      setRuleRepoInput("");
                    }}
                  >
                    Add rule
                  </InlineButton>
                </form>
                {notificationRules.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No rules — all repositories follow the global Immediate / Digest / Off settings
                  </p>
                ) : (
                  notificationRules.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-40 truncate text-sm">{rule.repo}</span>
                      <select
                        aria-label={`Kind for ${rule.repo}`}
                        value={rule.kind}
                        onChange={(event) =>
                          updateNotificationRule(rule.id, {
                            kind: event.currentTarget.value as NotificationRuleKind,
                          })
                        }
                        className="rounded-md px-2 py-1 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <option value="ciFailures">CI failures</option>
                        <option value="reviewRequests">Review requests</option>
                        <option value="mentions">Mentions</option>
                      </select>
                      <select
                        aria-label={`Priority for ${rule.repo} ${rule.kind}`}
                        value={rule.priority}
                        onChange={(event) =>
                          updateNotificationRule(rule.id, {
                            priority: event.currentTarget.value as NotificationDelivery,
                          })
                        }
                        className="rounded-md px-2 py-1 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <option value="immediate">Immediate</option>
                        <option value="digest">Digest</option>
                        <option value="off">Off</option>
                      </select>
                      <InlineButton
                        ariaLabel={`Remove rule for ${rule.repo} ${rule.kind}`}
                        onClick={() => removeNotificationRule(rule.id)}
                      >
                        Remove
                      </InlineButton>
                    </div>
                  ))
                )}
              </div>
            </Row>
            <Row label="Stale thresholds">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <span style={{ color: "var(--text-secondary)" }}>Review requests</span>
                  <input
                    type="number"
                    min={1}
                    aria-label="Stale review request threshold in days"
                    value={staleThresholds.reviewRequestDays}
                    onChange={(event) =>
                      setStaleThreshold("reviewRequestDays", event.currentTarget.valueAsNumber)
                    }
                    className="w-16 rounded-md px-2 py-1 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>days</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span style={{ color: "var(--text-secondary)" }}>My pulls</span>
                  <input
                    type="number"
                    min={1}
                    aria-label="Stale own pull threshold in days"
                    value={staleThresholds.myPullDays}
                    onChange={(event) =>
                      setStaleThreshold("myPullDays", event.currentTarget.valueAsNumber)
                    }
                    className="w-16 rounded-md px-2 py-1 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>days</span>
                </label>
              </div>
            </Row>
          </Section>
        )}

        {activeTab === "appearance" && <AppearanceSettingsSection />}

        {activeTab === "shortcuts" && (
          <Section
            title="Shortcuts"
            action={<InlineButton onClick={resetShortcuts}>Reset shortcuts</InlineButton>}
          >
            <Row label="Context chips">
              <Toggle
                checked={shortcutChipsEnabled}
                label="Show current shortcuts at bottom"
                onChange={setShortcutChipsEnabled}
              />
            </Row>
            {shortcutConflicts.length > 0 && (
              <div
                role="alert"
                className="mb-3 rounded-md border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--accent-orange, #fb923c)",
                  color: "var(--accent-orange, #fb923c)",
                  backgroundColor: "rgba(251, 146, 60, 0.08)",
                }}
              >
                Conflicting shortcuts:{" "}
                {shortcutConflicts
                  .map(
                    (c) =>
                      `${shortcuts[c.id].label} and ${shortcuts[c.otherId].label} both use ${displayShortcutKeys(c.keys)}`,
                  )
                  .join("; ")}
              </div>
            )}
            <div className="divide-y" style={sectionStyle()}>
              {SHORTCUT_IDS.map((id) => (
                <div
                  key={id}
                  className="grid min-h-12 grid-cols-[220px_1fr_auto] items-center gap-4 py-2"
                >
                  <label
                    htmlFor={`shortcut-${id}`}
                    className="text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {shortcuts[id].label}
                  </label>
                  <input
                    id={`shortcut-${id}`}
                    aria-label={`${shortcuts[id].label} shortcut`}
                    value={displayShortcutKeys(shortcuts[id].keys)}
                    onChange={(event) => setShortcut(id, event.target.value)}
                    onKeyDown={(event) => {
                      if (recordingId !== id) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const formatted = formatShortcutEvent(event.nativeEvent);
                      if (!formatted) return;
                      setShortcut(id, formatted);
                      setRecordingId(null);
                    }}
                    className="max-w-xs rounded-md px-3 py-1.5 font-mono text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: `1px solid ${
                        recordingId === id ? "var(--accent-blue)" : "var(--border-default)"
                      }`,
                      color: "var(--text-primary)",
                    }}
                    placeholder={recordingId === id ? "Press a key…" : undefined}
                  />
                  <InlineButton
                    active={recordingId === id}
                    onClick={() => setRecordingId((cur) => (cur === id ? null : id))}
                  >
                    {recordingId === id ? "Listening…" : "Record"}
                  </InlineButton>
                </div>
              ))}
            </div>
          </Section>
        )}

        {activeTab === "about" && (
          <Section title="About my-github">
            <Row label="Version" value={packageJson.version} />
            <Row label="License" value="MIT" />
            <Row label="GitHub API">
              {rateLimit ? (
                <span>
                  <span>{rateLimit.remaining} remaining</span>
                  <span> · resets at {formatReset(rateLimit.reset)}</span>
                </span>
              ) : rateError ? (
                <span style={{ color: "var(--accent-red)" }}>{rateError}</span>
              ) : rateLimitLoaded ? (
                <span style={{ color: "var(--text-muted)" }}>Not synced yet</span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Loading</span>
              )}
            </Row>
          </Section>
        )}

        {activeTab === "about" && <AboutLicensesSection />}

        {activeTab === "about" && (
          <Section title="Local LLM">
            <Row label="Enable">
              <Toggle
                checked={localLlm.enabled}
                label="Show PR summary panel"
                onChange={(checked) => setLocalLlm({ enabled: checked })}
              />
            </Row>
            <Row label="Allow remote">
              <Toggle
                checked={localLlm.allowRemote}
                label="Allow non-localhost endpoints"
                onChange={(checked) => setLocalLlm({ allowRemote: checked })}
              />
            </Row>
            <Row label="Endpoint">
              <input
                aria-label="Local LLM endpoint"
                value={localLlm.endpoint}
                onChange={(event) => setLocalLlm({ endpoint: event.target.value })}
                className="max-w-md rounded-md px-3 py-1.5 font-mono text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </Row>
            <Row label="Model">
              <input
                aria-label="Local LLM model"
                value={localLlm.model}
                onChange={(event) => setLocalLlm({ model: event.target.value })}
                className="max-w-md rounded-md px-3 py-1.5 font-mono text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </Row>
          </Section>
        )}
      </div>
    </div>
  );
}
