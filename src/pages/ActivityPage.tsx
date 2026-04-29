import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { Tabs } from "../components/common/Tabs";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { ActivityRow } from "../components/activity/ActivityRow";
import { useNotificationsQuery } from "../features/activity/useNotificationsQuery";
import { getTimeGroup } from "../lib/timeGroup";
import type { NotificationSummary } from "../stores/dataStore";

type TabKey = "all" | "unread" | "participating" | "mentions" | "review";
type TypeFilter = "all" | "pulls" | "issues" | "comments" | "ci" | "releases";

const TABS = [
  { key: "all" as TabKey, label: "All" },
  { key: "unread" as TabKey, label: "Unread" },
  { key: "participating" as TabKey, label: "Participating" },
  { key: "mentions" as TabKey, label: "Mentions" },
  { key: "review" as TabKey, label: "Review requests" },
];

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "pulls", label: "PRs" },
  { key: "issues", label: "Issues" },
  { key: "comments", label: "Comments" },
  { key: "ci", label: "CI" },
  { key: "releases", label: "Releases" },
];

const TAB_REASON: Partial<Record<TabKey, string>> = {
  participating: "participating",
  mentions: "mention",
  review: "review_requested",
};

const TYPE_SUBJECT: Partial<Record<TypeFilter, string[]>> = {
  pulls: ["PullRequest"],
  issues: ["Issue"],
  comments: ["Commit"],
  ci: ["CheckSuite"],
  releases: ["Release"],
};

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"] as const;

function notificationRoute(htmlUrl: string | null): string | null {
  if (!htmlUrl) return null;
  const match = htmlUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/,
  );
  if (!match) return null;
  const [, owner, repo, type, number] = match;
  return type === "pull"
    ? `/pulls/${owner}/${repo}/${number}`
    : `/issues/${owner}/${repo}/${number}`;
}

export default function ActivityPage() {
  const { notifications, loading, error, refetch } = useNotificationsQuery();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const navigate = useNavigate();

  const handleMarkAllRead = async () => {
    await invoke("cmd_mark_all_notifications_read");
    refetch();
  };

  const handleSelectNotification = async (notification: NotificationSummary) => {
    if (notification.unread) {
      await invoke("cmd_mark_notification_read", { threadId: notification.id });
      refetch();
    }
    const route = notificationRoute(notification.htmlUrl);
    if (route) navigate(route);
  };

  const filtered = useMemo(() => {
    let result = notifications;
    if (activeTab === "unread") result = result.filter((n) => n.unread);
    else if (TAB_REASON[activeTab])
      result = result.filter((n) => n.reason === TAB_REASON[activeTab]);

    if (typeFilter !== "all") {
      const allowed = TYPE_SUBJECT[typeFilter];
      if (allowed) result = result.filter((n) => allowed.includes(n.subjectType));
    }
    return result;
  }, [notifications, activeTab, typeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationSummary[]>();
    for (const n of filtered) {
      const g = getTimeGroup(n.updatedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    return map;
  }, [filtered]);

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Activity"
        actions={
          <button
            onClick={() => void handleMarkAllRead()}
            className="text-xs px-2 py-1 rounded-md"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              cursor: "pointer",
            }}
          >
            Mark all read
          </button>
        }
      />
      <Tabs
        items={TABS.map((t) => ({ id: t.key, label: t.label }))}
        activeId={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
      />
      <div
        className="px-4 py-2 flex gap-2 border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className="text-xs px-2 py-1 rounded-md flex-shrink-0"
            style={{
              backgroundColor:
                typeFilter === f.key ? "var(--accent-blue)" : "var(--bg-tertiary)",
              color: typeFilter === f.key ? "#fff" : "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading && !notifications.length && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <EmptyState title="Failed to load activity" subtitle={error} />}
      <div className="flex-1 overflow-y-auto">
        {!loading && filtered.length === 0 && (
          <EmptyState title="No activity" subtitle="Nothing matches the current filters" />
        )}
        {GROUP_ORDER.filter((g) => groups.has(g)).map((group) => (
          <div key={group}>
            <div
              className="px-4 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {group}
            </div>
            {groups.get(group)!.map((n) => (
              <ActivityRow
                key={n.id}
                notification={n}
                onSelect={() => void handleSelectNotification(n)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
