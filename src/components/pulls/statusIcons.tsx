import type { CSSProperties } from "react";
import type { PullSummary } from "../../stores/dataStore";

export type StatusKind =
  | "ci-success"
  | "ci-failure"
  | "ci-pending"
  | "review-requested"
  | "changes-requested"
  | "approved"
  | "draft"
  | "merged"
  | "mention"
  | "open"
  | "closed";

export function classifyPull(p: PullSummary): StatusKind {
  if (p.mergedAt || p.state === "merged") return "merged";
  if (p.isDraft) return "draft";
  if (p.state === "closed") return "closed";
  if (p.hasMention) return "mention";
  const ci = p.ciState;
  if (ci === "failure" || ci === "error") return "ci-failure";
  if (ci === "success") return "ci-success";
  if (ci === "pending" || ci === "queued" || ci === "in_progress")
    return "ci-pending";
  const rv = p.reviewState;
  if (rv === "approved") return "approved";
  if (rv === "changes_requested") return "changes-requested";
  if (rv === "review_required") return "review-requested";
  return "open";
}

const STYLE: Record<
  StatusKind,
  { glyph: string; color: string; title: string }
> = {
  "ci-success": { glyph: "✓", color: "var(--accent-green)", title: "CI passing" },
  "ci-failure": { glyph: "✗", color: "var(--accent-red)", title: "CI failing" },
  "ci-pending": { glyph: "●", color: "var(--accent-yellow)", title: "CI pending" },
  "review-requested": { glyph: "R", color: "var(--accent-blue)", title: "Review requested" },
  "changes-requested": { glyph: "R", color: "var(--accent-red)", title: "Changes requested" },
  approved: { glyph: "R", color: "var(--accent-green)", title: "Approved" },
  draft: { glyph: "D", color: "var(--text-muted)", title: "Draft" },
  merged: { glyph: "M", color: "var(--accent-purple)", title: "Merged" },
  mention: { glyph: "@", color: "var(--accent-yellow)", title: "Mentioned" },
  open: { glyph: "●", color: "var(--accent-green)", title: "Open" },
  closed: { glyph: "●", color: "var(--accent-red)", title: "Closed" },
};

export function StatusDot({ kind }: { kind: StatusKind }) {
  const s = STYLE[kind];
  const style: CSSProperties = {
    color: s.color,
    borderColor: s.color,
    width: 18,
    height: 18,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
  };
  return (
    <span
      title={s.title}
      aria-label={s.title}
      className="inline-flex items-center justify-center rounded-full border"
      style={style}
    >
      {s.glyph}
    </span>
  );
}
