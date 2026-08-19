import { useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { updateUnreadBadge } from "../../lib/badge";
import { useAccountAttentionSummaries } from "../../hooks/useAccountAttentionSummaries";
import { attentionTotal } from "../../lib/accountAttention";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import {
  useSettingsStore,
  type PinnedPullRef,
  type RecentPullRef,
} from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { Avatar } from "../common/Avatar";
import { classifyPull, StatusDot } from "../pulls/statusIcons";
import { WorkspaceSwitcher } from "../workspace/WorkspaceSwitcher";

const EMPTY_PINS: PinnedPullRef[] = [];
const EMPTY_RECENT: RecentPullRef[] = [];

interface NavItem {
  to: string;
  label: string;
  count?: number;
}

interface SidebarProps {
  onSignOut?: () => void;
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const accountId = user?.login ?? "";
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const notifications = useDataStore((s) => s.notifications);
  const dockBadgeEnabled = useSettingsStore((s) => s.dockBadgeEnabled);
  const savedFilters = useSettingsStore((s) => s.savedFilters);
  const pinnedRefs = useSettingsStore((s) => s.pinnedPullsByAccount[accountId] ?? EMPTY_PINS);
  const recentRefs = useSettingsStore((s) => s.recentPullsByAccount[accountId] ?? EMPTY_RECENT);
  const togglePinnedPull = useSettingsStore((s) => s.togglePinnedPull);
  const removeSavedFilter = useSettingsStore((s) => s.removeSavedFilter);
  const renameSavedFilter = useSettingsStore((s) => s.renameSavedFilter);
  const openSwitcher = useUiStore((s) => s.openWorkspaceSwitcher);
  const { crossAccountTotal, summaries } = useAccountAttentionSummaries(true);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const activeAttention =
    summaries.find((s) => s.isActive) ?? summaries.find((s) => s.login === user?.login);
  const inboxCount = activeAttention ? attentionTotal(activeAttention) : 0;
  const inboxBadge = inboxCount > 0 ? inboxCount : undefined;

  useEffect(() => {
    void updateUnreadBadge(unreadCount, dockBadgeEnabled);
  }, [unreadCount, dockBadgeEnabled]);

  const pinnedPulls = useMemo(
    () =>
      pinnedRefs.map((ref) => {
        const pull = pulls.find((p) => p.repo === ref.repo && p.number === ref.number);
        return { ref, pull };
      }),
    [pinnedRefs, pulls],
  );

  const navItems: NavItem[] = [
    { to: "/inbox", label: "Inbox", count: inboxBadge },
    { to: "/review-queue", label: "Review queue" },
    { to: "/my-blockers", label: "My blockers" },
    { to: "/pulls", label: "Pull Requests", count: pulls.length || undefined },
    { to: "/issues", label: "Issues", count: issues.length || undefined },
    { to: "/activity", label: "Activity" },
    { to: "/digest", label: "Digest" },
    { to: "/dashboards", label: "Dashboards" },
    { to: "/releases", label: "Releases" },
    { to: "/code-search", label: "Code search" },
    { to: "/ci", label: "CI Status" },
    { to: "/settings", label: "Settings" },
  ];

  const otherAccountCount = summaries.filter((s) => !s.isActive && s.login !== accountId).length;

  return (
    <>
      <div className="flex flex-col h-full">
        <button
          className="px-4 py-4 border-b text-left w-full"
          style={{ borderColor: "var(--border-default)", background: "none", cursor: "pointer" }}
          onClick={openSwitcher}
        >
          <p
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Workspace
          </p>
          <p
            className="text-sm font-semibold mt-1 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            my-github
          </p>
          {crossAccountTotal > 0 && (
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--text-muted)" }}
              title="Review + CI fail + Mentions across cached accounts"
            >
              All accounts · {crossAccountTotal}
              {otherAccountCount > 0 ? ` (+${otherAccountCount} other)` : ""}
            </p>
          )}
        </button>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Primary">
          <ul className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className="flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors"
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 500,
                  })}
                >
                  <span>{item.label}</span>
                  {typeof item.count === "number" && (
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "var(--bg-overlay)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {recentRefs.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="px-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Recent
              </p>
              <ul className="flex flex-col gap-0.5" aria-label="Recent pull requests">
                {recentRefs.slice(0, 10).map((ref) => {
                  const [owner, repoName] = ref.repo.split("/");
                  const to = `/pulls/${owner}/${repoName}/${ref.number}`;
                  const pull = pulls.find((p) => p.repo === ref.repo && p.number === ref.number);
                  const title = pull?.title ?? ref.title;
                  const kind = pull ? classifyPull(pull) : "open";
                  return (
                    <li key={`recent-${ref.repo}#${ref.number}`}>
                      <NavLink
                        to={to}
                        className="flex min-w-0 items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                        style={({ isActive }) => ({
                          backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: isActive ? 600 : 500,
                        })}
                        title={title}
                      >
                        <StatusDot kind={kind} />
                        <span className="truncate">{title}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {pinnedPulls.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="px-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Pinned
              </p>
              <ul className="flex flex-col gap-0.5" aria-label="Pinned pull requests">
                {pinnedPulls.map(({ ref, pull }) => {
                  const [owner, repoName] = ref.repo.split("/");
                  const to = `/pulls/${owner}/${repoName}/${ref.number}`;
                  const title = pull?.title ?? `${ref.repo}#${ref.number}`;
                  const kind = pull ? classifyPull(pull) : "open";
                  return (
                    <li key={`${ref.repo}#${ref.number}`} className="group flex items-center">
                      <NavLink
                        to={to}
                        className="flex flex-1 min-w-0 items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                        style={({ isActive }) => ({
                          backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: isActive ? 600 : 500,
                        })}
                        title={title}
                      >
                        <StatusDot kind={kind} />
                        <span className="truncate">{title}</span>
                      </NavLink>
                      <button
                        type="button"
                        aria-label={`Unpin ${title}`}
                        onClick={() => togglePinnedPull(accountId, ref.repo, ref.number)}
                        className="hidden group-hover:block px-1.5 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {savedFilters.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="px-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Views
              </p>
              <ul className="flex flex-col gap-0.5">
                {savedFilters.map((view) => (
                  <li key={view.id} className="group flex items-center">
                    <NavLink
                      to={`/${view.target}?${view.query}`}
                      className="flex-1 min-w-0 px-3 py-1.5 rounded-md text-sm truncate transition-colors"
                      style={{ color: "var(--text-secondary)", fontWeight: 500 }}
                      title={`${view.target}: ${view.name}`}
                    >
                      {view.name}
                    </NavLink>
                    <button
                      type="button"
                      aria-label={`Rename view ${view.name}`}
                      onClick={() => {
                        const next = window.prompt("Rename view", view.name);
                        if (next) renameSavedFilter(view.id, next);
                      }}
                      className="hidden group-hover:block px-1.5 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove view ${view.name}`}
                      onClick={() => removeSavedFilter(view.id)}
                      className="hidden group-hover:block px-1.5 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div
          className="px-3 py-3 border-t flex items-center gap-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          {user && (
            <>
              <Avatar login={user.login} src={user.avatar_url} size="sm" />
              <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                {user.login}
              </span>
            </>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-[11px] px-2 py-1 rounded-md"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
      <WorkspaceSwitcher onSignOut={onSignOut} />
    </>
  );
}
