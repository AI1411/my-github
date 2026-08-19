import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatRelativeTime } from "../../lib/relativeTime";
import { useDataStore } from "../../stores/dataStore";

interface RateLimitInfo {
  remaining: number;
  reset: number;
}

interface SyncStatusResult {
  lastRateLimit?: RateLimitInfo | null;
  last_rate_limit?: RateLimitInfo | null;
}

export function SyncStatusBar() {
  const lastSyncedAt = useDataStore((s) => s.lastSyncedAt);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void invoke<SyncStatusResult>("cmd_get_sync_status")
      .then((result) => {
        if (cancelled) return;
        const rate = result.lastRateLimit ?? result.last_rate_limit ?? null;
        setRemaining(rate?.remaining ?? null);
      })
      .catch(() => {
        if (!cancelled) setRemaining(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lastSyncedAt]);

  const syncedLabel = lastSyncedAt
    ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
    : "Never synced";

  return (
    <div
      role="status"
      data-testid="sync-status-bar"
      title="Background sync covers watched repositories, open pull requests, and issues. Notifications and CI are fetched on demand."
      className="flex-shrink-0 border-t px-4 py-1.5 text-[11px] flex items-center justify-between gap-3"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "var(--bg-secondary)",
        color: "var(--text-muted)",
      }}
    >
      <span>
        {syncedLabel}
        <span className="hidden sm:inline text-[10px] opacity-80">
          {" "}
          · syncs repos, pulls &amp; issues
        </span>
      </span>
      {remaining !== null && <span>{remaining} remaining</span>}
    </div>
  );
}
