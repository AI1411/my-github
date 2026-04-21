import { useMemo } from "react";
import { Toolbar } from "../components/common/Toolbar";
import { useIssuesQuery } from "../features/issues/useIssuesQuery";
import { useUiStore } from "../stores/uiStore";
import {
  FilterSidebar,
  type AvailableLabel,
} from "../components/issues/FilterSidebar";
import { AppliedFilters } from "../components/issues/AppliedFilters";

export default function IssuesPage() {
  const filter = useUiStore((s) => s.issueFilters);
  const setFilter = useUiStore((s) => s.setIssueFilters);
  const { issues, refreshing } = useIssuesQuery(filter);

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
    () =>
      Array.from(
        new Set(issues.flatMap((i) => i.assignees.map((a) => a.login))),
      ),
    [issues],
  );
  const availableRepos = useMemo(
    () => Array.from(new Set(issues.map((i) => i.repo))),
    [issues],
  );
  const availableMilestones = useMemo(
    () =>
      Array.from(
        new Set(
          issues
            .map((i) => i.milestone)
            .filter((m): m is string => !!m),
        ),
      ),
    [issues],
  );

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        title="Issues"
        subtitle={refreshing ? "Refreshing…" : undefined}
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
          <div data-testid="issues-list" className="flex-1 overflow-auto" />
        </section>
      </div>
    </div>
  );
}
