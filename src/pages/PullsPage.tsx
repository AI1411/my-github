import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { Tabs, type TabItem } from "../components/common/Tabs";
import { PullRow } from "../components/pulls/PullRow";
import { FilterChips } from "../components/pulls/FilterChips";
import {
  usePullsQuery,
  type PullFilter,
  type PullTab,
} from "../features/pulls/usePullsQuery";
import { useListNavigation } from "../hooks/useListNavigation";

const TABS: TabItem<PullTab>[] = [
  { id: "created", label: "Created" },
  { id: "assigned", label: "Assigned" },
  { id: "review", label: "Review" },
  { id: "mentioned", label: "Mentioned" },
  { id: "all", label: "All" },
];

const ROW_HEIGHT = 56;

export default function PullsPage() {
  const [filter, setFilter] = useState<PullFilter>({
    tab: "all",
    state: "open",
  });
  const { pulls, loading, refreshing, error } = usePullsQuery(filter);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const availableRepos = useMemo(
    () => Array.from(new Set(pulls.map((p) => p.repo))),
    [pulls],
  );
  const availableAuthors = useMemo(
    () =>
      Array.from(
        new Set(pulls.map((p) => p.author).filter((a): a is string => !!a)),
      ),
    [pulls],
  );
  const availableLabels: string[] = [];

  const openPull = (p: (typeof pulls)[number]) => {
    const [owner, repo] = p.repo.split("/");
    navigate(`/pulls/${owner}/${repo}/${p.number}`);
  };

  const { activeIndex, setActiveId } = useListNavigation({
    items: pulls,
    getId: (p) => String(p.id),
    onOpen: openPull,
    enabled: pulls.length > 0,
  });

  const rowVirtualizer = useVirtualizer({
    count: pulls.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        title="Pull Requests"
        subtitle={refreshing ? "Refreshing…" : undefined}
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
      {loading && pulls.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState title="Failed to load pull requests" subtitle={error} />
      ) : pulls.length === 0 ? (
        <EmptyState
          title="No pull requests"
          subtitle="Try changing the filter, or sync to fetch fresh data."
        />
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          role="grid"
          tabIndex={0}
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((v) => {
              const pull = pulls[v.index];
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
