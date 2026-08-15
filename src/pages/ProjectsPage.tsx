import { EmptyState } from "../components/common/EmptyState";
import { Toolbar } from "../components/common/Toolbar";

export default function ProjectsPage() {
  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Projects"
        subtitle="Overview of project boards (coming soon)"
      />
      <EmptyState
        title="Projects browsing coming soon"
        subtitle="GitHub Projects (v2) is GraphQL-only; this view is a placeholder until a dedicated sync lands."
      />
    </div>
  );
}
