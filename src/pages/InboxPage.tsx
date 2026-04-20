import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function InboxPage() {
  return (
    <div>
      <Toolbar title="Inbox" subtitle="Review requests, CI failures, mentions" />
      <EmptyState
        title="You're all caught up"
        subtitle="No new items — Inbox will be implemented in M7."
      />
    </div>
  );
}
