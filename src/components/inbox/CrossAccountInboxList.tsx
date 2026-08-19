import type { CrossAccountInboxItem } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";
import { EmptyState } from "../common/EmptyState";
import { Avatar } from "../common/Avatar";
import { inboxReasonLabel } from "./InboxItem";

interface CrossAccountInboxListProps {
  items: CrossAccountInboxItem[];
  selectedId: string | null;
  onSelect: (item: CrossAccountInboxItem) => void;
}

/**
 * Flat, account-tagged Inbox list for the "All accounts" toggle. Kept
 * separate from `InboxList` (which groups by section for the single-account
 * view) since cross-account rows need an account badge and there's no
 * per-account pin/snooze support yet.
 */
export function CrossAccountInboxList({ items, selectedId, onSelect }: CrossAccountInboxListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={
          <span aria-hidden style={{ fontSize: 22 }}>
            ✓
          </span>
        }
        title="Inbox zero across accounts"
        subtitle="No review requests, CI failures, or mentions for any cached account."
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto" role="grid" aria-label="Cross-account inbox">
      {items.map((item) => (
        <div
          key={`${item.accountLogin}:${item.id}`}
          role="row"
          tabIndex={0}
          onClick={() => onSelect(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelect(item);
          }}
          className="group px-4 flex items-start gap-3 cursor-pointer border-b outline-none"
          style={{
            backgroundColor: selectedId === item.id ? "var(--bg-overlay)" : "transparent",
            borderColor: "var(--border-subtle)",
            paddingBlock: "var(--row-pad-y)",
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
          <Avatar
            login={item.accountLogin}
            src={item.accountAvatarUrl ?? undefined}
            size="xs"
            title={item.isActiveAccount ? `${item.accountLogin} (active)` : item.accountLogin}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {item.title}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              <span
                data-testid="cross-account-badge"
                style={{
                  color: item.isActiveAccount ? "var(--text-muted)" : "var(--accent-blue)",
                }}
              >
                @{item.accountLogin}
              </span>
              {" · "}
              {item.repo}
              {item.number !== null && ` #${item.number}`}
              {" · "}
              {inboxReasonLabel(item.kind)}
              {" · "}
              {formatRelativeTime(item.updatedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
