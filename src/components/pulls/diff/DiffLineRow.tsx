import type { CSSProperties } from "react";
import type { DiffLine } from "./parseDiff";

export interface DiffLineCommentTarget {
  line: number;
  side: "LEFT" | "RIGHT";
}

export interface DiffLineRowProps {
  line: DiffLine;
  showOld?: boolean;
  showNew?: boolean;
  /** When set, gutters are clickable to start an inline review comment. */
  onCommentLine?: (target: DiffLineCommentTarget) => void;
  /** Highlight when this line has a pending draft comment. */
  pending?: boolean;
}

const STYLE: Record<DiffLine["kind"], CSSProperties> = {
  hunk: {
    backgroundColor: "rgba(93, 129, 216, 0.08)",
    color: "var(--accent-blue)",
    fontStyle: "italic",
  },
  addition: {
    backgroundColor: "rgba(87, 188, 116, 0.12)",
    color: "var(--text-primary)",
  },
  deletion: {
    backgroundColor: "rgba(232, 83, 83, 0.12)",
    color: "var(--text-primary)",
  },
  context: { color: "var(--text-secondary)" },
  meta: { color: "var(--text-muted)", fontStyle: "italic" },
};

const GUTTER: CSSProperties = {
  color: "var(--text-muted)",
  fontVariantNumeric: "tabular-nums",
  padding: "0 8px",
  textAlign: "right",
  userSelect: "none",
  width: 44,
  minWidth: 44,
  borderRight: "1px solid var(--border-subtle)",
};

export function DiffLineRow({
  line,
  showOld = true,
  showNew = true,
  onCommentLine,
  pending = false,
}: DiffLineRowProps) {
  const sign = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
  const canComment = line.kind === "addition" || line.kind === "deletion" || line.kind === "context";

  const startOnOld = () => {
    if (!onCommentLine || !canComment || line.oldNumber == null) return;
    onCommentLine({ line: line.oldNumber, side: "LEFT" });
  };
  const startOnNew = () => {
    if (!onCommentLine || !canComment || line.newNumber == null) return;
    onCommentLine({ line: line.newNumber, side: "RIGHT" });
  };

  const rowStyle: CSSProperties = {
    ...STYLE[line.kind],
    ...(pending
      ? { outline: "1px solid color-mix(in srgb, var(--accent-blue) 50%, transparent)" }
      : {}),
  };

  return (
    <div className="flex font-mono text-xs leading-5 group/diff" style={rowStyle}>
      {showOld && (
        <button
          type="button"
          style={{
            ...GUTTER,
            background: "transparent",
            cursor: onCommentLine && canComment && line.oldNumber != null ? "pointer" : "default",
          }}
          title={onCommentLine && canComment ? "Add comment" : undefined}
          aria-label={
            onCommentLine && canComment && line.oldNumber != null
              ? `Add comment on left line ${line.oldNumber}`
              : undefined
          }
          disabled={!onCommentLine || !canComment || line.oldNumber == null}
          onClick={startOnOld}
        >
          {line.oldNumber ?? ""}
        </button>
      )}
      {showNew && (
        <button
          type="button"
          style={{
            ...GUTTER,
            background: "transparent",
            cursor: onCommentLine && canComment && line.newNumber != null ? "pointer" : "default",
          }}
          title={onCommentLine && canComment ? "Add comment" : undefined}
          aria-label={
            onCommentLine && canComment && line.newNumber != null
              ? `Add comment on right line ${line.newNumber}`
              : undefined
          }
          disabled={!onCommentLine || !canComment || line.newNumber == null}
          onClick={startOnNew}
        >
          {line.newNumber ?? ""}
        </button>
      )}
      <span style={{ width: 16, textAlign: "center", color: "var(--text-muted)" }}>{sign}</span>
      <span className="whitespace-pre flex-1 overflow-x-auto">{line.content}</span>
    </div>
  );
}
