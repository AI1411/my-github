import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";
import { ListSearchBar } from "../components/common/ListSearchBar";
import { Spinner } from "../components/common/Spinner";
import { Tabs, type TabItem } from "../components/common/Tabs";
import { PullRow } from "../components/pulls/PullRow";
import { FilterChips } from "../components/pulls/FilterChips";
import { usePullsQuery, type PullFilter, type PullTab } from "../features/pulls/usePullsQuery";
import { useListNavigation } from "../hooks/useListNavigation";
import { useListSearch } from "../hooks/useListSearch";
import { matchesListSearch } from "../lib/listSearch";
import { pullFilterToQuery, queryToPullFilter } from "../lib/savedFilters";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

const TABS: TabItem<PullTab>[] = [
  { id: "created", label: "Created" },
  { id: "assigned", label: "Assigned" },
  { id: "review", label: "Review" },
  { id: "mentioned", label: "Mentioned" },
  { id: "all", label: "All" },
];

const ROW_HEIGHT = 56;

export default function PullsPage() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<PullFilter>(() => queryToPullFilter(searchParams));
  const searchKey = searchParams.toString();
  useEffect(() => {
    setFilter(queryToPullFilter(searchKey));
  }, [searchKey]);
  const { pulls, loading, refreshing, error } = usePullsQuery(filter);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const addSavedFilter = useSettingsStore((s) => s.addSavedFilter);
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const listSearch = useListSearch(accountId, "pulls");

  const handleSaveView = () => {
    const name = window.prompt("View name");
    if (!name) return;
    addSavedFilter({ name, target: "pulls", query: pullFilterToQuery(filter) });
  };

  const availableRepos = useMemo(() => Array.from(new Set(pulls.map((p) => p.repo))), [pulls]);
  const availableAuthors = useMemo(
    () => Array.from(new Set(pulls.map((p) => p.author).filter((a): a is string => !!a))),
    [pulls],
  );
  const availableLabels: string[] = [];

  const visiblePulls = useMemo(
    () =>
      pulls.filter((p) =>
        matchesListSearch(`${p.title} ${p.repo} ${p.author ?? ""}`, listSearch.query),
      ),
    [pulls, listSearch.query],
  );

  const openPull = (p: (typeof pulls)[number]) => {
    const [owner, repo] = p.repo.split("/");
    navigate(`/pulls/${owner}/${repo}/${p.number}`);
  };

  const { activeIndex, setActiveId } = useListNavigation({
    items: visiblePulls,
    getId: (p) => String(p.id),
    onOpen: openPull,
    enabled: visiblePulls.length > 0,
  });

  const rowVirtualizer = useVirtualizer({
    count: visiblePulls.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        title="Pull Requests"
        subtitle={refreshing ? "Refreshing…" : undefined}
        actions={
          <button
            type="button"
            onClick={handleSaveView}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Save view
          </button>
        }
      />
      <Tabs
        items={TABS}
        activeId={filter.tab ?? "all"}
        onChange={(tab) => setFilter({ ...filter, tab })}
      />
      <FilterChips
        filter={filter}
        onChange={setFilter}
        availableRepos={availableRepos}
        availableAuthors={availableAuthors}
        availableLabels={availableLabels}
      />
      <ListSearchBar
        open={listSearch.open}
        query={listSearch.query}
        onQueryChange={listSearch.setQuery}
        inputRef={listSearch.inputRef}
        placeholder="Filter pull requests…"
      />
      {loading && pulls.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState title="Failed to load pull requests" subtitle={error} />
      ) : visiblePulls.length === 0 ? (
        <EmptyState
          title="No pull requests"
          subtitle="Try changing the filter, or sync to fetch fresh data."
        />
      ) : (
        <div ref={containerRef} className="flex-1 overflow-auto" role="grid" tabIndex={0}>
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((v) => {
              const pull = visiblePulls[v.index];
              return (
                <PullRow
                  key={pull.id}
                  pull={pull}
                  selected={activeIndex === v.index}
                  onSelect={() => setActiveId(String(pull.id))}
                  onOpen={() => openPull(pull)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: v.size,
                    transform: `translateY(${v.start}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
