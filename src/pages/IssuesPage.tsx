import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Toolbar } from "../components/common/Toolbar";
import { SaveViewControl } from "../components/common/SaveViewControl";
import { ListSearchBar } from "../components/common/ListSearchBar";
import { ListSkeleton } from "../components/common/ListSkeleton";
import { useIssuesQuery } from "../features/issues/useIssuesQuery";
import { useAuthStore } from "../stores/authStore";
import { useUiStore } from "../stores/uiStore";
import { useSettingsStore } from "../stores/settingsStore";
import { FilterSidebar, type AvailableLabel } from "../components/issues/FilterSidebar";
import { AppliedFilters } from "../components/issues/AppliedFilters";
import { IssueRow } from "../components/issues/IssueRow";
import { useListNavigation } from "../hooks/useListNavigation";
import { useListSearch } from "../hooks/useListSearch";
import { useDetailPrefetch } from "../hooks/useDetailPrefetch";
import { listRowHeight } from "../lib/appearance";
import { matchesListSearch } from "../lib/listSearch";
import { issueFilterToQuery, queryToIssueFilter } from "../lib/savedFilters";

export default function IssuesPage() {
  const filter = useUiStore((s) => s.issueFilters);
  const setFilter = useUiStore((s) => s.setIssueFilters);
  const { issues, loading, refreshing } = useIssuesQuery(filter);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const addSavedFilter = useSettingsStore((s) => s.addSavedFilter);
  const density = useSettingsStore((s) => s.density);
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const listSearch = useListSearch(accountId, "issues");

  useEffect(() => {
    if (searchKey) setFilter(queryToIssueFilter(searchKey));
  }, [searchKey, setFilter]);

  const handleSaveView = (name: string) => {
    addSavedFilter({ name, target: "issues", query: issueFilterToQuery(filter) });
  };

  const availableLabels = useMemo<AvailableLabel[]>(() => {
    const map = new Map<string, AvailableLabel>();
    for (const i of issues) {
      for (const l of i.labels) {
        const cur = map.get(l.name);
        if (cur) cur.count += 1;
        else map.set(l.name, { name: l.name, color: l.color, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [issues]);

  const availableAssignees = useMemo(
    () => Array.from(new Set(issues.flatMap((i) => i.assignees.map((a) => a.login)))),
    [issues],
  );
  const availableRepos = useMemo(() => Array.from(new Set(issues.map((i) => i.repo))), [issues]);
  const availableMilestones = useMemo(
    () => Array.from(new Set(issues.map((i) => i.milestone).filter((m): m is string => !!m))),
    [issues],
  );

  const visibleIssues = useMemo(
    () =>
      issues.filter((i) => matchesListSearch(`${i.title} ${i.repo} ${i.number}`, listSearch.query)),
    [issues, listSearch.query],
  );

  const openIssue = useCallback(
    (i: (typeof issues)[number]) => {
      const [owner, repo] = i.repo.split("/");
      navigate(`/issues/${owner}/${repo}/${i.number}`);
    },
    [navigate],
  );

  const { activeIndex, setActiveId, activeItem } = useListNavigation({
    items: visibleIssues,
    getId: (i) => String(i.id),
    onOpen: openIssue,
    enabled: visibleIssues.length > 0,
  });

  useDetailPrefetch(
    "issue",
    activeItem ? { repo: activeItem.repo, number: activeItem.number } : null,
  );

  const rowVirtualizer = useVirtualizer({
    count: visibleIssues.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => listRowHeight(density),
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        title="Issues"
        subtitle={refreshing ? "Refreshing…" : undefined}
        actions={<SaveViewControl onSave={handleSaveView} />}
      />
      <div
        data-testid="issues-page-root"
        className="flex-1 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gridTemplateRows: "1fr",
          minHeight: 0,
        }}
      >
        <aside
          data-testid="issues-sidebar"
          className="border-r overflow-y-auto"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <FilterSidebar
            filter={filter}
            onChange={setFilter}
            availableLabels={availableLabels}
            availableAssignees={availableAssignees}
            availableRepos={availableRepos}
            availableMilestones={availableMilestones}
          />
        </aside>
        <section className="flex flex-col min-w-0">
          <div
            data-testid="issues-filters"
            className="border-b px-4 py-2 min-h-[40px]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <AppliedFilters filter={filter} onChange={setFilter} />
          </div>
          <ListSearchBar
            open={listSearch.open}
            query={listSearch.query}
            onQueryChange={listSearch.setQuery}
            inputRef={listSearch.inputRef}
            placeholder="Filter issues…"
          />
          <div
            ref={containerRef}
            data-testid="issues-list"
            className="flex-1 overflow-auto"
            role="grid"
            tabIndex={0}
          >
            {loading && issues.length === 0 ? (
              <ListSkeleton />
            ) : (
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((v) => {
                  const issue = visibleIssues[v.index];
                  return (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      selected={activeIndex === v.index}
                      onSelect={() => setActiveId(String(issue.id))}
                      onOpen={() => openIssue(issue)}
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
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
