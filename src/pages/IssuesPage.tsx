import { useState } from "react";
import { Toolbar } from "../components/common/Toolbar";
import { useIssuesQuery } from "../features/issues/useIssuesQuery";
import type { IssueFilter } from "../features/issues/issueFilter";

export default function IssuesPage() {
  const [filter] = useState<IssueFilter>({ labels: [], state: "open" });
  const { refreshing } = useIssuesQuery(filter);

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
          {/* FilterSidebar comes in Task 8 */}
        </aside>
        <section className="flex flex-col min-w-0">
          <div
            data-testid="issues-filters"
            className="border-b px-4 py-2"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {/* AppliedFilters comes in Task 11 */}
          </div>
          <div data-testid="issues-list" className="flex-1 overflow-auto">
            {/* IssueRow list comes in Task 6 */}
          </div>
        </section>
      </div>
    </div>
  );
}
