import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { Tabs } from "../components/common/Tabs";
import { EmptyState } from "../components/common/EmptyState";
import { ListSearchBar } from "../components/common/ListSearchBar";
import { ListSkeleton } from "../components/common/ListSkeleton";
import { ActivityRow } from "../components/activity/ActivityRow";
import { useNotificationPollingContext } from "../features/activity/NotificationPollingContext";
import { useReleasesQuery } from "../features/activity/useReleasesQuery";
import { useListSearch } from "../hooks/useListSearch";
import { matchesListSearch } from "../lib/listSearch";
import { notificationRoute } from "../lib/notificationRoutes";
import { releaseToNotification } from "../lib/releases";
import { getTimeGroup } from "../lib/timeGroup";
import { useAuthStore } from "../stores/authStore";
import { useDataStore, type NotificationSummary } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";
import { listRowHeight } from "../lib/appearance";
import { openInBrowser } from "../lib/openInBrowser";

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
const GROUP_HEADER_HEIGHT = 32;

type VirtualActivityRow =
  | { kind: "header"; id: string; title: string }
  | { kind: "item"; id: string; notification: NotificationSummary };

export default function ActivityPage() {
  const notifications = useDataStore((state) => state.notifications);
  const { loading, error, refetch } = useNotificationPollingContext();
  const { releases } = useReleasesQuery();
  const density = useSettingsStore((s) => s.density);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = listRowHeight(density);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const navigate = useNavigate();
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const listSearch = useListSearch(accountId, "activity");

  const handleMarkAllRead = async () => {
    await invoke("cmd_mark_all_notifications_read");
    refetch();
  };

  const handleSelectNotification = async (notification: NotificationSummary) => {
    if (notification.reason === "release") {
      if (notification.htmlUrl) await openInBrowser(notification.htmlUrl);
      return;
    }
    if (notification.unread) {
      await invoke("cmd_mark_notification_read", { threadId: notification.id });
      refetch();
    }
    const route = notificationRoute(notification.htmlUrl);
    if (route) navigate(route);
  };

  const merged = useMemo(
    () => [...notifications, ...releases.map(releaseToNotification)],
    [notifications, releases],
  );

  const filtered = useMemo(() => {
    let result = merged;
    if (activeTab === "unread") result = result.filter((n) => n.unread);
    else if (TAB_REASON[activeTab])
      result = result.filter((n) => n.reason === TAB_REASON[activeTab]);

    if (typeFilter !== "all") {
      const allowed = TYPE_SUBJECT[typeFilter];
      if (allowed) result = result.filter((n) => allowed.includes(n.subjectType));
    }
    if (listSearch.query.trim()) {
      result = result.filter((n) =>
        matchesListSearch(`${n.subjectTitle} ${n.repo ?? ""}`, listSearch.query),
      );
    }
    return result;
  }, [merged, activeTab, typeFilter, listSearch.query]);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationSummary[]>();
    for (const n of filtered) {
      const g = getTimeGroup(n.updatedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    return map;
  }, [filtered]);

  const virtualRows = useMemo(() => {
    const rows: VirtualActivityRow[] = [];
    for (const group of GROUP_ORDER) {
      const items = groups.get(group);
      if (!items?.length) continue;
      rows.push({ kind: "header", id: `header-${group}`, title: group });
      for (const notification of items) {
        rows.push({ kind: "item", id: notification.id, notification });
      }
    }
    return rows;
  }, [groups]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) =>
      virtualRows[index]?.kind === "header" ? GROUP_HEADER_HEIGHT : rowHeight,
    overscan: 10,
  });

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
              backgroundColor: typeFilter === f.key ? "var(--accent-blue)" : "var(--bg-tertiary)",
              color: typeFilter === f.key ? "#fff" : "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ListSearchBar
        open={listSearch.open}
        query={listSearch.query}
        onQueryChange={listSearch.setQuery}
        inputRef={listSearch.inputRef}
        placeholder="Filter activity…"
      />
      {loading && !notifications.length && <ListSkeleton />}
      {error &&
        (notifications.length ? (
          <div
            role="alert"
            className="px-4 py-2 text-xs border-b"
            style={{
              backgroundColor: "rgba(248, 81, 73, 0.12)",
              borderColor: "var(--border-default)",
              color: "var(--accent-red)",
            }}
          >
            {error}
          </div>
        ) : (
          <EmptyState title="Failed to load activity" subtitle={error} />
        ))}
      <div ref={containerRef} className="flex-1 overflow-y-auto" role="grid">
        {!loading && !error && filtered.length === 0 && (
          <EmptyState title="No activity" subtitle="Nothing matches the current filters" />
        )}
        {virtualRows.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((v) => {
              const row = virtualRows[v.index];
              if (!row) return null;
              if (row.kind === "header") {
                return (
                  <div
                    key={row.id}
                    className="px-4 py-1.5 text-xs font-semibold"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: v.size,
                      transform: `translateY(${v.start}px)`,
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {row.title}
                  </div>
                );
              }
              return (
                <div
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: v.size,
                    transform: `translateY(${v.start}px)`,
                  }}
                >
                  <ActivityRow
                    notification={row.notification}
                    onSelect={() => void handleSelectNotification(row.notification)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
