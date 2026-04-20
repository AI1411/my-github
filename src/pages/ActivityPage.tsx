import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function ActivityPage() {
  return (
    <div>
      <Toolbar title="Activity" />
      <EmptyState
        title="No activity yet"
        subtitle="Activity feed will be implemented in M7."
      />
    </div>
  );
}
