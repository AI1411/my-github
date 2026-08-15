import type { CSSProperties } from "react";
import type { PullSummary } from "../../stores/dataStore";
import { formatRelativeTime } from "../../lib/relativeTime";
import { Avatar } from "../common/Avatar";
import { classifyPull, StatusDot } from "./statusIcons";
import { ReviewerGroup } from "./ReviewerGroup";

export interface PullRowProps {
  pull: PullSummary;
  selected?: boolean;
  stale?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  style?: CSSProperties;
}

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px 56px minmax(0,1fr) 140px 140px 100px 100px 72px",
  alignItems: "center",
  gap: 12,
};

export function PullRow({ pull, selected, stale, onSelect, onOpen, style }: PullRowProps) {
  const kind = classifyPull(pull);
  const bg = selected
    ? "var(--bg-overlay)"
    : stale
      ? "rgba(251, 146, 60, 0.08)"
      : "transparent";
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onOpen?.();
        }
      }}
      className="px-4 py-2 cursor-pointer border-b outline-none"
      style={{
        ...GRID,
        ...style,
        backgroundColor: bg,
        borderColor: stale ? "rgba(251, 146, 60, 0.35)" : "var(--border-subtle)",
      }}
      aria-label={stale ? `${pull.title} (stale)` : undefined}
    >
      <div style={{ justifySelf: "center" }}>
        <StatusDot kind={kind} />
      </div>
      <div
        style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
        className="text-xs"
      >
        #{pull.number}
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
          title={pull.title}
        >
          {pull.title}
          {stale && (
            <span
              className="ml-2 text-[10px] uppercase tracking-wide"
              style={{ color: "var(--accent-orange, #fb923c)" }}
            >
              Stale
            </span>
          )}
        </span>
        <span className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {pull.repo} · {pull.headRef} → {pull.baseRef}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {pull.author && (
          <>
            <Avatar login={pull.author} size="sm" />
            <span className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
              {pull.author}
            </span>
          </>
        )}
      </div>
      <div>
        <ReviewerGroup reviewers={pull.requestedReviewers} reviewState={pull.reviewState} />
      </div>
      <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
        {pull.changedFiles !== null ? `${pull.changedFiles} files` : "—"}
      </div>
      <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
        {pull.additions !== null && pull.deletions !== null
          ? `+${pull.additions} -${pull.deletions}`
          : "—"}
      </div>
      <div className="text-xs text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
        {formatRelativeTime(pull.updatedAt)}
      </div>
    </div>
  );
}
