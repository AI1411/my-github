import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  defaultSavedSearchName,
  isAdvancedSearchQuery,
  shouldRunGithubSearch,
} from "../../lib/advancedSearch";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore, type RecentPullRef } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { useDataStore } from "../../stores/dataStore";
import { useSettingsShortcut } from "../../hooks/useSettingsShortcut";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const EMPTY_RECENT: RecentPullRef[] = [];

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  kind: "nav" | "pr" | "issue" | "search" | "next" | "saved" | "action" | "recent" | "mode";
  href?: string;
  /** When true, selecting fills the query and keeps the palette open. */
  keepOpen?: boolean;
  action?: () => void;
}

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-inbox", label: "Go to Inbox", kind: "nav", href: "/inbox" },
  { id: "nav-review-queue", label: "Go to Review queue", kind: "nav", href: "/review-queue" },
  { id: "nav-pulls", label: "Go to Pull Requests", kind: "nav", href: "/pulls" },
  { id: "nav-issues", label: "Go to Issues", kind: "nav", href: "/issues" },
  { id: "nav-activity", label: "Go to Activity", kind: "nav", href: "/activity" },
  { id: "nav-dashboards", label: "Go to Dashboards", kind: "nav", href: "/dashboards" },
  { id: "nav-releases", label: "Go to Releases", kind: "nav", href: "/releases" },
  { id: "nav-discussions", label: "Go to Discussions", kind: "nav", href: "/discussions" },
  { id: "nav-projects", label: "Go to Projects", kind: "nav", href: "/projects" },
  { id: "nav-code-search", label: "Go to Code search", kind: "nav", href: "/code-search" },
  { id: "nav-ci", label: "Go to CI Status", kind: "nav", href: "/ci" },
  { id: "nav-settings", label: "Go to Settings", kind: "nav", href: "/settings" },
];
const KIND_LABEL: Record<CommandItem["kind"], string> = {
  nav: "→",
  pr: "PR",
  issue: "ISS",
  search: "GH",
  next: "!",
  saved: "★",
  action: "+",
  recent: "R",
  mode: "M",
};

function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

export function CommandPalette() {
  const isOpen = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const toggle = useUiStore((s) => s.toggleCommandPalette);
  const openWorkspaceSwitcher = useUiStore((s) => s.openWorkspaceSwitcher);
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const markLastSynced = useDataStore((s) => s.markLastSynced);
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const recentPulls = useSettingsStore((s) => s.recentPullsByAccount[accountId] ?? EMPTY_RECENT);
  const savedSearches = useSettingsStore((s) => s.savedSearches);
  const addSavedSearch = useSettingsStore((s) => s.addSavedSearch);
  const workModes = useSettingsStore((s) => s.workModes);
  const activateWorkMode = useSettingsStore((s) => s.activateWorkMode);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  const advanced = searchMode || isAdvancedSearchQuery(query);

  useSettingsShortcut("commandPalette", toggle, {
    allowInInputs: true,
  });

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSearchMode(false);
      setSelectedIndex(0);
      setRemoteResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const localItems = useMemo((): CommandItem[] => {
    if (advanced && query.trim()) {
      const alreadySaved = savedSearches.some((s) => s.query === query.trim());
      const saveItem: CommandItem | null = alreadySaved
        ? null
        : {
            id: "action-save-search",
            label: "Save this search",
            subtitle: query.trim(),
            kind: "action",
            keepOpen: true,
            action: () => {
              addSavedSearch(defaultSavedSearchName(query), query);
            },
          };
      return saveItem ? [saveItem] : [];
    }

    if (!query) {
      const actionItems: CommandItem[] = [
        { id: "nav-digest", label: "Go to Digest", kind: "nav", href: "/digest" },
        {
          id: "action-sync",
          label: "Sync now",
          kind: "action",
          action: () => {
            void invoke("cmd_sync_now").then(() => markLastSynced());
          },
        },
        {
          id: "action-mark-all",
          label: "Mark all as read",
          kind: "action",
          action: () => {
            void invoke("cmd_mark_all_notifications_read");
          },
        },
        {
          id: "action-switch-account",
          label: "Switch account",
          kind: "action",
          action: () => {
            openWorkspaceSwitcher();
          },
        },
      ];
      const savedItems: CommandItem[] = savedSearches.map((s) => ({
        id: `saved-${s.id}`,
        label: s.name,
        subtitle: s.query,
        kind: "saved" as const,
        keepOpen: true,
        action: () => {
          setSearchMode(true);
          setQuery(s.query);
        },
      }));
      const recentItems: CommandItem[] = recentPulls.slice(0, 8).map((r) => ({
        id: `recent-${r.repo}-${r.number}`,
        label: r.title,
        subtitle: `Recent · ${r.repo} #${r.number}`,
        kind: "recent" as const,
        href: `/pulls/${r.repo}/${r.number}`,
      }));
      const nextActions: CommandItem[] = [];
      for (const pull of pulls) {
        if (pull.state !== "open" || pull.isDraft) continue;
        if (pull.ciState === "failure") {
          nextActions.push({
            id: `next-ci-${pull.id}`,
            label: pull.title,
            subtitle: `CI failing · ${pull.repo} #${pull.number}`,
            kind: "next",
            href: `/pulls/${pull.repo}/${pull.number}`,
          });
        } else if (
          pull.reviewState === "pending" ||
          pull.reviewState === "changes_requested" ||
          pull.hasMention
        ) {
          nextActions.push({
            id: `next-review-${pull.id}`,
            label: pull.title,
            subtitle: `Needs attention · ${pull.repo} #${pull.number}`,
            kind: "next",
            href: `/pulls/${pull.repo}/${pull.number}`,
          });
        }
        if (nextActions.length >= 5) break;
      }
      const modeItems: CommandItem[] = workModes.map((mode) => ({
        id: `mode-${mode.id}`,
        label: `Switch to ${mode.name}`,
        subtitle: `Work mode · ${mode.watchedRepositories.length} repos`,
        kind: "mode",
        action: () => {
          const path = activateWorkMode(mode.id);
          if (path) navigate(path);
        },
      }));
      return [
        ...modeItems,
        ...savedItems,
        ...recentItems,
        ...nextActions,
        ...actionItems,
        ...NAV_COMMANDS,
      ];
    }

    const modeMatches = workModes
      .filter((m) => fuzzyMatch(query, m.name) || fuzzyMatch(query, "mode"))
      .map(
        (mode): CommandItem => ({
          id: `mode-${mode.id}`,
          label: `Switch to ${mode.name}`,
          subtitle: `Work mode · ${mode.homePath}`,
          kind: "mode",
          action: () => {
            const path = activateWorkMode(mode.id);
            if (path) navigate(path);
          },
        }),
      );
    const navMatches = NAV_COMMANDS.filter((c) => fuzzyMatch(query, c.label));
    const actionMatches: CommandItem[] = [
      { id: "nav-digest", label: "Go to Digest", kind: "nav" as const, href: "/digest" },
      {
        id: "action-sync",
        label: "Sync now",
        kind: "action" as const,
        action: () => {
          void invoke("cmd_sync_now").then(() => markLastSynced());
        },
      },
      {
        id: "action-mark-all",
        label: "Mark all as read",
        kind: "action" as const,
        action: () => {
          void invoke("cmd_mark_all_notifications_read");
        },
      },
      {
        id: "action-switch-account",
        label: "Switch account",
        kind: "action" as const,
        action: () => {
          openWorkspaceSwitcher();
        },
      },
    ].filter((c) => fuzzyMatch(query, c.label));
    const recentMatches = recentPulls
      .filter((r) => fuzzyMatch(query, r.title) || fuzzyMatch(query, r.repo))
      .slice(0, 5)
      .map(
        (r): CommandItem => ({
          id: `recent-${r.repo}-${r.number}`,
          label: r.title,
          subtitle: `Recent · ${r.repo} #${r.number}`,
          kind: "recent",
          href: `/pulls/${r.repo}/${r.number}`,
        }),
      );
    const prMatches = pulls
      .filter((p) => fuzzyMatch(query, p.title) || fuzzyMatch(query, p.repo))
      .slice(0, 5)
      .map(
        (p): CommandItem => ({
          id: `pr-${p.repo}-${p.number}`,
          label: p.title,
          subtitle: `PR #${p.number} · ${p.repo}`,
          kind: "pr",
          href: `/pulls/${p.repo}/${p.number}`,
        }),
      );
    const issueMatches = issues
      .filter((i) => fuzzyMatch(query, i.title) || fuzzyMatch(query, i.repo))
      .slice(0, 5)
      .map(
        (i): CommandItem => ({
          id: `issue-${i.repo}-${i.number}`,
          label: i.title,
          subtitle: `Issue #${i.number} · ${i.repo}`,
          kind: "issue",
          href: `/issues/${i.repo}/${i.number}`,
        }),
      );
    return [
      ...modeMatches,
      ...actionMatches,
      ...navMatches,
      ...recentMatches,
      ...prMatches,
      ...issueMatches,
    ];
  }, [
    query,
    pulls,
    issues,
    advanced,
    savedSearches,
    addSavedSearch,
    recentPulls,
    workModes,
    activateWorkMode,
    navigate,
    markLastSynced,
    openWorkspaceSwitcher,
  ]);

  const allItems = useMemo(() => {
    if (advanced && query.trim()) {
      return [...remoteResults, ...localItems];
    }
    return [...localItems, ...remoteResults];
  }, [localItems, remoteResults, advanced, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  useEffect(() => {
    if (!shouldRunGithubSearch(query, searchMode)) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const trimmed = query.trim();
      invoke<
        {
          id: number;
          number: number;
          title: string;
          state: string;
          htmlUrl: string;
          repo: string;
          kind: string;
        }[]
      >("cmd_search_github", { query: trimmed })
        .then((results) => {
          if (searchSeqRef.current !== seq) return;
          const limit = advanced ? 10 : 5;
          setRemoteResults(
            results.slice(0, limit).map((r) => ({
              id: `gh-${r.id}`,
              label: r.title,
              subtitle: `#${r.number} · ${r.repo} · GitHub`,
              kind: "search" as const,
              href:
                r.kind === "pull"
                  ? `/pulls/${r.repo}/${r.number}`
                  : `/issues/${r.repo}/${r.number}`,
            })),
          );
        })
        .catch(() => {
          if (searchSeqRef.current !== seq) return;
          setRemoteResults([]);
        })
        .finally(() => {
          if (searchSeqRef.current !== seq) return;
          setSearching(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchMode, advanced]);

  const handleSelect = (item: CommandItem) => {
    item.action?.();
    if (item.keepOpen) {
      setSelectedIndex(0);
      return;
    }
    if (item.href) navigate(item.href);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setSearchMode((mode) => !mode);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item) handleSelect(item);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center px-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span className="mr-2 text-sm" style={{ color: "var(--text-muted)" }}>
            ⌘
          </span>
          {searchMode && (
            <span
              className="mr-2 text-xs px-1.5 py-0.5 rounded"
              style={{
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-tertiary)",
              }}
            >
              Search
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={
              searchMode ? "GitHub search (is:pr, repo:…)" : "Search or jump to… (Tab: search mode)"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 py-3 text-sm bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {searching && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Searching…
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {!query && savedSearches.length > 0 && (
            <p
              className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Saved searches
            </p>
          )}
          {!query && recentPulls.length > 0 && (
            <p
              className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Recent
            </p>
          )}
          {allItems.length === 0 && (
            <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
              {advanced && query.trim()
                ? searching
                  ? "Searching…"
                  : "No GitHub results"
                : "No results"}
            </p>
          )}
          {allItems.map((item, i) => (
            <div
              key={item.id}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => handleSelect(item)}
              className="px-4 py-2 flex items-center gap-3 cursor-pointer"
              style={{
                backgroundColor: i === selectedIndex ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "var(--text-muted)", width: 32 }}
              >
                {KIND_LABEL[item.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.label}
                </p>
                {item.subtitle && (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {item.subtitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div
          className="px-4 py-1.5 flex items-center gap-3 border-t text-xs"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Tab search</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
