import { Avatar } from "../common/Avatar";
import type { ReviewerInfo } from "../../stores/dataStore";

export type ReviewRing = "approved" | "changes" | null;

export interface ReviewerGroupProps {
  reviewers: ReviewerInfo[];
  reviewState?: string | null;
  max?: number;
}

function reviewerRing(state: string | null | undefined): ReviewRing {
  if (state === "approved") return "approved";
  if (state === "changes_requested") return "changes";
  return null;
}

export function ReviewerGroup({ reviewers, reviewState, max = 3 }: ReviewerGroupProps) {
  if (!reviewers.length) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const visible = reviewers.slice(0, max);
  const overflow = reviewers.length - visible.length;
  const ring = reviewerRing(reviewState);
  const ringColor =
    ring === "approved"
      ? "var(--accent-green)"
      : ring === "changes"
        ? "var(--accent-red)"
        : "transparent";

  return (
    <span className="inline-flex items-center -space-x-2">
      {visible.map((r) => (
        <span
          key={r.login}
          className="rounded-full"
          style={{
            boxShadow: ring !== null ? `0 0 0 2px ${ringColor}` : undefined,
          }}
        >
          <Avatar login={r.login} src={r.avatarUrl} size="sm" />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold"
          style={{
            width: 20,
            height: 20,
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
