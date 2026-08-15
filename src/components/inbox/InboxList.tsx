import type { InboxData, InboxItem } from "../../stores/dataStore";
import type { SnoozeOption } from "../../lib/snooze";
import { InboxItemRow } from "./InboxItem";
import { EmptyState } from "../common/EmptyState";

interface InboxListProps {
  data: InboxData | null;
  staleItems?: InboxItem[];
  selectedId: string | null;
  onSelect: (item: InboxItem) => void;
  onTogglePin?: (item: InboxItem) => void;
  onSnooze?: (item: InboxItem, option: SnoozeOption) => void;
  registerItemRef?: (id: string) => (el: HTMLElement | null) => void;
}

function Section({
  title,
  items,
  selectedId,
  onSelect,
  onTogglePin,
  onSnooze,
  registerItemRef,
  tone = "default",
}: {
  title: string;
  items: InboxItem[];
  selectedId: string | null;
  onSelect: (item: InboxItem) => void;
  onTogglePin?: (item: InboxItem) => void;
  onSnooze?: (item: InboxItem, option: SnoozeOption) => void;
  registerItemRef?: (id: string) => (el: HTMLElement | null) => void;
  tone?: "default" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div
        className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b"
        style={{
          color: tone === "warning" ? "var(--accent-orange, #fb923c)" : "var(--text-muted)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <InboxItemRow
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onSelect={() => onSelect(item)}
          onTogglePin={onTogglePin}
          onSnooze={onSnooze}
          rowRef={registerItemRef?.(item.id)}
        />
      ))}
    </div>
  );
}

export function InboxList({
  data,
  staleItems = [],
  selectedId,
  onSelect,
  onTogglePin,
  onSnooze,
  registerItemRef,
}: InboxListProps) {
  if (!data) return null;

  const isEmpty =
    staleItems.length === 0 &&
    data.reviewRequests.length === 0 &&
    data.ciFailures.length === 0 &&
    data.mentions.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        title="You're all caught up"
        subtitle="No review requests, CI failures, or mentions"
      />
    );
  }

  return (
    <div>
      <Section
        title="Stale"
        tone="warning"
        items={staleItems}
        selectedId={selectedId}
        onSelect={onSelect}
        registerItemRef={registerItemRef}
      />
      <Section
        title="Review Requests"
        items={data.reviewRequests}
        selectedId={selectedId}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onSnooze={onSnooze}
        registerItemRef={registerItemRef}
      />
      <Section
        title="CI Failures"
        items={data.ciFailures}
        selectedId={selectedId}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onSnooze={onSnooze}
        registerItemRef={registerItemRef}
      />
      <Section
        title="Mentions"
        items={data.mentions}
        selectedId={selectedId}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onSnooze={onSnooze}
        registerItemRef={registerItemRef}
      />
    </div>
  );
}
