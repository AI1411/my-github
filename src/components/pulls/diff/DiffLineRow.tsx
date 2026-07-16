import type { CSSProperties } from "react";
import type { DiffLine } from "./parseDiff";

export interface DiffLineRowProps {
  line: DiffLine;
  showOld?: boolean;
  showNew?: boolean;
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

export function DiffLineRow({ line, showOld = true, showNew = true }: DiffLineRowProps) {
  const sign = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
  return (
    <div className="flex font-mono text-xs leading-5" style={STYLE[line.kind]}>
      {showOld && <span style={GUTTER}>{line.oldNumber ?? ""}</span>}
      {showNew && <span style={GUTTER}>{line.newNumber ?? ""}</span>}
      <span style={{ width: 16, textAlign: "center", color: "var(--text-muted)" }}>{sign}</span>
      <span className="whitespace-pre flex-1 overflow-x-auto">{line.content}</span>
    </div>
  );
}
