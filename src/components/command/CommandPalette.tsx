import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../stores/uiStore";
import { useDataStore } from "../../stores/dataStore";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  kind: "nav" | "pr" | "issue" | "search" | "next";
  href?: string;
  action?: () => void;
}

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-inbox", label: "Go to Inbox", kind: "nav", href: "/inbox" },
  { id: "nav-pulls", label: "Go to Pull Requests", kind: "nav", href: "/pulls" },
  { id: "nav-issues", label: "Go to Issues", kind: "nav", href: "/issues" },
  { id: "nav-activity", label: "Go to Activity", kind: "nav", href: "/activity" },
  { id: "nav-ci", label: "Go to CI Status", kind: "nav", href: "/ci" },
  { id: "nav-settings", label: "Go to Settings", kind: "nav", href: "/settings" },
];

const KIND_LABEL: Record<CommandItem["kind"], string> = {
  nav: "→",
  pr: "PR",
  issue: "ISS",
  search: "GH",
  next: "!",
};

function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

export function CommandPalette() {
  const isOpen = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const toggle = useUiStore((s) => s.toggleCommandPalette);
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useKeyboardShortcut({ key: "k", meta: true, preventDefault: true }, toggle, {
    allowInInputs: true,
  });

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setRemoteResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const localItems = useMemo((): CommandItem[] => {
    const nextActions: CommandItem[] = [];
    if (!query) {
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
      return [...nextActions, ...NAV_COMMANDS];
    }
    const navMatches = NAV_COMMANDS.filter((c) => fuzzyMatch(query, c.label));
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
    return [...navMatches, ...prMatches, ...issueMatches];
  }, [query, pulls, issues]);

  const allItems = useMemo(() => [...localItems, ...remoteResults], [localItems, remoteResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  useEffect(() => {
    if (!query || query.length < 3) {
      setRemoteResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
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
      >("cmd_search_github", { query })
        .then((results) => {
          setRemoteResults(
            results.slice(0, 5).map((r) => ({
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
        .catch(() => setRemoteResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    item.action?.();
    if (item.href) navigate(item.href);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
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
      role="dialog"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={close}
    >
      <div
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
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or jump to…"
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
          {allItems.length === 0 && (
            <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
              No results
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
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
