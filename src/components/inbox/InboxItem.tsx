import type { InboxItem } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";

export interface InboxItemRowProps {
  item: InboxItem;
  selected?: boolean;
  onSelect?: () => void;
}

export function InboxItemRow({ item, selected, onSelect }: InboxItemRowProps) {
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect?.();
      }}
      className="px-4 py-3 flex items-start gap-3 cursor-pointer border-b outline-none"
      style={{
        backgroundColor: selected ? "var(--bg-overlay)" : "transparent",
        borderColor: "var(--border-subtle)",
      }}
    >
      {item.unread ? (
        <span
          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: "var(--accent-blue)" }}
          aria-label="Unread"
        />
      ) : (
        <span className="mt-1.5 w-2 h-2 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {item.title}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {item.repo}
          {item.number !== null && ` #${item.number}`}
          {" · "}
          {formatRelativeTime(item.updatedAt)}
        </p>
      </div>
    </div>
  );
}
