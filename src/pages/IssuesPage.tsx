import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { ListSearchBar } from "../components/common/ListSearchBar";
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
import { matchesListSearch } from "../lib/listSearch";
import { issueFilterToQuery, queryToIssueFilter } from "../lib/savedFilters";

export default function IssuesPage() {
  const filter = useUiStore((s) => s.issueFilters);
  const setFilter = useUiStore((s) => s.setIssueFilters);
  const { issues, refreshing } = useIssuesQuery(filter);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const addSavedFilter = useSettingsStore((s) => s.addSavedFilter);
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const listSearch = useListSearch(accountId, "issues");

  useEffect(() => {
    if (searchKey) setFilter(queryToIssueFilter(searchKey));
  }, [searchKey, setFilter]);

  const handleSaveView = () => {
    const name = window.prompt("View name");
    if (!name) return;
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
      issues.filter((i) =>
        matchesListSearch(`${i.title} ${i.repo} ${i.number}`, listSearch.query),
      ),
    [issues, listSearch.query],
  );

  const openIssue = (i: (typeof issues)[number]) => {
    const [owner, repo] = i.repo.split("/");
    navigate(`/issues/${owner}/${repo}/${i.number}`);
  };

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

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        title="Issues"
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
          <div data-testid="issues-list" className="flex-1 overflow-auto">
            {visibleIssues.map((issue, idx) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                selected={activeIndex === idx}
                onSelect={() => setActiveId(String(issue.id))}
                onOpen={() => openIssue(issue)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
