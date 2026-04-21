import { useState } from "react";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { InboxList } from "../components/inbox/InboxList";
import { InboxDetailPanel } from "../components/inbox/InboxDetailPanel";
import { useInboxQuery } from "../features/inbox/useInboxQuery";
import type { InboxItem } from "../stores/dataStore";

export default function InboxPage() {
  const { data, loading, error } = useInboxQuery();
  const [selected, setSelected] = useState<InboxItem | null>(null);

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Inbox"
        subtitle="Review requests · CI failures · Mentions"
      />
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && (
        <EmptyState title="Failed to load inbox" subtitle={error} />
      )}
      {data && (
        <div
          className="flex-1 grid overflow-hidden"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div
            className="overflow-y-auto border-r"
            style={{ borderColor: "var(--border-default)" }}
          >
            <InboxList
              data={data}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>
          <div className="overflow-y-auto">
            <InboxDetailPanel item={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
