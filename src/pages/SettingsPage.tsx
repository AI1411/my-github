import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import packageJson from "../../package.json";
import { Tabs } from "../components/common/Tabs";
import { Toolbar } from "../components/common/Toolbar";
import { useRepoSearchQuery } from "../features/settings/useRepoSearchQuery";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import {
  DEFAULT_SHORTCUTS,
  useSettingsStore,
  type PollingInterval,
  type ShortcutId,
} from "../stores/settingsStore";

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

function sectionStyle() {
  return {
    borderColor: "var(--border-subtle)",
  };
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-b px-6 py-5" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="grid min-h-11 grid-cols-[220px_1fr] items-center gap-4 border-t py-2 first:border-t-0"
      style={sectionStyle()}
    >
      <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="min-w-0 text-sm" style={{ color: "var(--text-primary)" }}>
        {children ?? value}
      </div>
    </div>
  );
}

function InlineButton({
  children,
  onClick,
  active = false,
  disabled = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
      style={{
        backgroundColor: active ? "var(--accent-blue)" : "var(--bg-tertiary)",
        border: "1px solid var(--border-default)",
        color: active ? "#ffffff" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function formatReset(epochSeconds: number): string {
  if (!epochSeconds) return "unknown";
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("accounts");
  const [repoInput, setRepoInput] = useState("");
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateLimitLoaded, setRateLimitLoaded] = useState(false);
  const user = useAuthStore((state) => state.user);
  const pulls = useDataStore((state) => state.pulls);
  const issues = useDataStore((state) => state.issues);
  const notifications = useDataStore((state) => state.notifications);
  const watchedRepositories = useSettingsStore((state) => state.watchedRepositories);
  const notificationSettings = useSettingsStore((state) => state.notificationSettings);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const dockBadgeEnabled = useSettingsStore((state) => state.dockBadgeEnabled);
  const density = useSettingsStore((state) => state.density);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const addWatchedRepository = useSettingsStore((state) => state.addWatchedRepository);
  const removeWatchedRepository = useSettingsStore((state) => state.removeWatchedRepository);
  const setNotificationSetting = useSettingsStore((state) => state.setNotificationSetting);
  const staleThresholds = useSettingsStore((state) => state.staleThresholds);
  const setStaleThreshold = useSettingsStore((state) => state.setStaleThreshold);
  const repoNotificationRules = useSettingsStore((state) => state.repoNotificationRules);
  const setRepoNotificationRule = useSettingsStore((state) => state.setRepoNotificationRule);
  const addRepoNotificationRule = useSettingsStore((state) => state.addRepoNotificationRule);
  const removeRepoNotificationRule = useSettingsStore((state) => state.removeRepoNotificationRule);
  const [ruleRepoInput, setRuleRepoInput] = useState("");
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
  const setDensity = useSettingsStore((state) => state.setDensity);
  const setShortcut = useSettingsStore((state) => state.setShortcut);
  const resetShortcuts = useSettingsStore((state) => state.resetShortcuts);

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
  };

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
          <Section title="Accounts" action={<InlineButton>Add account</InlineButton>}>
            <Row label="Active account">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{user?.login ?? "Not signed in"}</span>
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
            <Row label="Startup digest">
              <Toggle
                checked={digestAutoShowEnabled}
                label="Show digest when returning after 6+ hours"
                onChange={setDigestAutoShowEnabled}
              />
            </Row>
            <Row label="Per-repository rules">
              <div className="flex flex-col gap-2">
                <form
                  className="flex max-w-xl gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addRepoNotificationRule(ruleRepoInput);
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
                  <InlineButton
                    onClick={() => {
                      addRepoNotificationRule(ruleRepoInput);
                      setRuleRepoInput("");
                    }}
                  >
                    Add rule
                  </InlineButton>
                </form>
                {Object.keys(repoNotificationRules).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No per-repository rules — all repositories follow the global settings
                  </p>
                ) : (
                  Object.entries(repoNotificationRules).map(([repo, rule]) => (
                    <div key={repo} className="flex flex-wrap items-center gap-4">
                      <span className="min-w-48 truncate text-sm">{repo}</span>
                      <Toggle
                        checked={rule.ciFailures}
                        label="CI failures"
                        onChange={(checked) => setRepoNotificationRule(repo, "ciFailures", checked)}
                      />
                      <Toggle
                        checked={rule.reviewRequests}
                        label="Review requests"
                        onChange={(checked) =>
                          setRepoNotificationRule(repo, "reviewRequests", checked)
                        }
                      />
                      <Toggle
                        checked={rule.mentions}
                        label="Mentions"
                        onChange={(checked) => setRepoNotificationRule(repo, "mentions", checked)}
                      />
                      <InlineButton
                        ariaLabel={`Remove rule for ${repo}`}
                        onClick={() => removeRepoNotificationRule(repo)}
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

        {activeTab === "appearance" && (
          <Section title="Appearance">
            <Row label="Theme" value="Dark" />
            <Row label="Density">
              <div className="flex flex-wrap gap-2">
                <InlineButton
                  active={density === "comfortable"}
                  onClick={() => setDensity("comfortable")}
                >
                  Comfortable
                </InlineButton>
                <InlineButton active={density === "compact"} onClick={() => setDensity("compact")}>
                  Compact
                </InlineButton>
              </div>
            </Row>
          </Section>
        )}

        {activeTab === "shortcuts" && (
          <Section
            title="Shortcuts"
            action={<InlineButton onClick={resetShortcuts}>Reset shortcuts</InlineButton>}
          >
            <div className="divide-y" style={sectionStyle()}>
              {SHORTCUT_IDS.map((id) => (
                <div
                  key={id}
                  className="grid min-h-12 grid-cols-[220px_1fr] items-center gap-4 py-2"
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
                    value={shortcuts[id].keys}
                    onChange={(event) => setShortcut(id, event.target.value)}
                    className="max-w-xs rounded-md px-3 py-1.5 font-mono text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
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
      </div>
    </div>
  );
}
