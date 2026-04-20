import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function SettingsPage() {
  return (
    <div>
      <Toolbar title="Settings" />
      <EmptyState
        title="Settings coming soon"
        subtitle="Settings panels will be implemented in M8."
      />
    </div>
  );
}
