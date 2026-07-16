import type { CSSProperties } from "react";
import type { IssueSummary } from "../../stores/dataStore";
import { LabelPill } from "../common/LabelPill";
import { formatRelativeTime } from "../../lib/relativeTime";
import { AvatarStack } from "./AvatarStack";

export interface IssueRowProps {
  issue: IssueSummary;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  style?: CSSProperties;
}

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px 56px minmax(0,1fr) 96px 64px 100px",
  alignItems: "center",
  gap: 12,
};

function StatusDot({ state }: { state: string }) {
  const isOpen = state === "open";
  const color = isOpen ? "var(--accent-green)" : "var(--accent-purple)";
  const label = isOpen ? "Open" : "Closed";
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-block w-3 h-3 rounded-full border"
      style={{ backgroundColor: color, borderColor: color }}
    />
  );
}

export function IssueRow({ issue, selected, onSelect, onOpen, style }: IssueRowProps) {
  const bg = selected ? "var(--bg-overlay)" : "transparent";
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.();
      }}
      className="px-4 py-2 cursor-pointer border-b outline-none"
      style={{
        ...GRID,
        ...style,
        backgroundColor: bg,
        borderColor: "var(--border-subtle)",
      }}
    >
      <div style={{ justifySelf: "center" }}>
        <StatusDot state={issue.state} />
      </div>
      <div
        className="text-xs"
        style={{
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        #{issue.number}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
            title={issue.title}
          >
            {issue.title}
          </span>
          {issue.labels.slice(0, 4).map((l) => (
            <LabelPill key={l.name} name={l.name} color={l.color} />
          ))}
        </div>
        <span className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {issue.repo}
          {issue.author && ` · opened by ${issue.author}`}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <AvatarStack users={issue.assignees} max={3} />
      </div>
      <div
        className="text-xs tabular-nums text-right"
        style={{ color: "var(--text-muted)" }}
        title={`${issue.comments} comments`}
      >
        {issue.comments}
      </div>
      <div className="text-xs tabular-nums text-right" style={{ color: "var(--text-muted)" }}>
        {formatRelativeTime(issue.updatedAt)}
      </div>
    </div>
  );
}
