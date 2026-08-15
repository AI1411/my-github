import { invoke } from "@tauri-apps/api/core";
import type { InboxItem } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";

interface InboxDetailPanelProps {
  item: InboxItem | null;
  onOpenInApp?: (item: InboxItem) => void;
}

export function InboxDetailPanel({ item, onOpenInApp }: InboxDetailPanelProps) {
  if (!item) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select an item to preview
        </p>
      </div>
    );
  }

  const handleOpen = () => {
    if (item.htmlUrl) {
      void invoke("cmd_open_run_logs", { htmlUrl: item.htmlUrl });
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {item.repo}
        {item.number !== null && ` #${item.number}`}
      </p>
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {item.title}
      </h2>
      <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
        Updated {formatRelativeTime(item.updatedAt)}
      </p>
      <div className="flex items-center gap-2">
        {onOpenInApp && (
          <button
            type="button"
            onClick={() => onOpenInApp(item)}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: "var(--accent-blue)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Open
          </button>
        )}
        {item.htmlUrl && (
          <button
            type="button"
            onClick={handleOpen}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: onOpenInApp ? "var(--bg-tertiary)" : "var(--accent-blue)",
              color: onOpenInApp ? "var(--text-primary)" : "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Open in Browser
          </button>
        )}
      </div>
    </div>
  );
}
