import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function IssuesPage() {
  return (
    <div>
      <Toolbar title="Issues" />
      <EmptyState
        title="No issues yet"
        subtitle="Issue list will be implemented in M6."
      />
    </div>
  );
}
