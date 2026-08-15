import type { InboxItem } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";
import { SNOOZE_OPTIONS, type SnoozeOption } from "../../lib/snooze";

export interface InboxItemRowProps {
  item: InboxItem;
  selected?: boolean;
  onSelect?: () => void;
  onTogglePin?: (item: InboxItem) => void;
  onSnooze?: (item: InboxItem, option: SnoozeOption) => void;
  rowRef?: (el: HTMLElement | null) => void;
}

export function InboxItemRow({
  item,
  selected,
  onSelect,
  onTogglePin,
  onSnooze,
  rowRef,
}: InboxItemRowProps) {
  return (
    <div
      ref={rowRef}
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect?.();
      }}
      className="group px-4 py-3 flex items-start gap-3 cursor-pointer border-b outline-none"
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
          {item.pinned && (
            <span
              className="mr-1.5 text-[11px]"
              style={{ color: "var(--accent-yellow, #eab308)" }}
              aria-label="Pinned"
            >
              ⬥
            </span>
          )}
          {item.title}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {item.repo}
          {item.number !== null && ` #${item.number}`}
          {" · "}
          {formatRelativeTime(item.updatedAt)}
        </p>
      </div>
      {(onTogglePin || onSnooze) && (
        <div
          className={`${selected ? "flex" : "hidden group-hover:flex"} items-center gap-1 flex-shrink-0`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onTogglePin && (
            <button
              type="button"
              aria-label={item.pinned ? "Unpin" : "Pin"}
              title={item.pinned ? "Unpin" : "Pin"}
              onClick={() => onTogglePin(item)}
              className="px-1.5 py-0.5 rounded text-[11px]"
              style={{
                color: item.pinned ? "var(--accent-yellow, #eab308)" : "var(--text-muted)",
                backgroundColor: "var(--bg-tertiary)",
              }}
            >
              {item.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {onSnooze &&
            SNOOZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-label={`Snooze until ${option.label}`}
                title={`Snooze until ${option.label}`}
                onClick={() => onSnooze(item, option.id)}
                className="px-1.5 py-0.5 rounded text-[11px]"
                style={{
                  color: "var(--text-muted)",
                  backgroundColor: "var(--bg-tertiary)",
                }}
              >
                {option.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
