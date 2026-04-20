import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function PullsPage() {
  return (
    <div>
      <Toolbar title="Pull Requests" />
      <EmptyState
        title="No pull requests yet"
        subtitle="PR list will be implemented in M5."
      />
    </div>
  );
}
