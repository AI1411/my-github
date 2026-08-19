import { EmptyState } from "../components/common/EmptyState";
import { Toolbar } from "../components/common/Toolbar";

export default function DiscussionsPage() {
  return (
    <div className="h-full flex flex-col">
      <Toolbar title="Discussions" subtitle="Browse repository discussions (coming soon)" />
      <EmptyState
        title="Discussions browsing coming soon"
        subtitle="GitHub Discussions require GraphQL or search-heavy REST; this view is a placeholder for a future sync."
      />
    </div>
  );
}
