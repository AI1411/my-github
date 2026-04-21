import type { NotificationSummary } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";

const ICONS: Record<string, string> = {
  review_requested: "👁",
  mention: "@",
  assign: "◉",
  comment: "💬",
  push: "↑",
  ci_activity: "⚙",
  release: "⬡",
  subscribed: "◎",
};

interface ActivityRowProps {
  notification: NotificationSummary;
  selected?: boolean;
  onSelect?: () => void;
}

export function ActivityRow({ notification, selected, onSelect }: ActivityRowProps) {
  const icon = ICONS[notification.reason] ?? "·";

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect?.(); }}
      className="px-4 py-2.5 flex items-start gap-3 cursor-pointer border-b outline-none"
      style={{
        backgroundColor: selected ? "var(--bg-overlay)" : "transparent",
        borderColor: "var(--border-subtle)",
      }}
    >
      <span
        className="text-xs w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        aria-label={notification.reason}
        data-testid="activity-icon"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {notification.unread && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "var(--accent-blue)" }}
              data-testid="unread-dot"
            />
          )}
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {notification.subjectTitle}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {notification.repo}
          {" · "}
          {notification.reason.replace(/_/g, " ")}
        </p>
      </div>
      <span
        className="text-xs flex-shrink-0 tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        {formatRelativeTime(notification.updatedAt)}
      </span>
    </div>
  );
}
