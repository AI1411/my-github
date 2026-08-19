import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface BlockingCheck {
  name: string;
  conclusion: string;
}

export interface MergeReadiness {
  mergeable: boolean | null;
  mergeableState: string | null;
  approvals: number;
  changesRequested: number;
  ciState: string | null;
  isDraft: boolean;
  ready: boolean;
  blockers: string[];
  blockingChecks: BlockingCheck[];
  requiredReviewsRemaining: number;
}

interface MergeReadinessBadgeProps {
  owner: string;
  repo: string;
  number: number;
  refreshKey?: number;
}

function hasDetail(readiness: MergeReadiness): boolean {
  return (
    readiness.blockingChecks.length > 0 ||
    readiness.requiredReviewsRemaining > 0 ||
    readiness.changesRequested > 0 ||
    readiness.blockers.length > 0
  );
}

export function MergeReadinessBadge({
  owner,
  repo,
  number,
  refreshKey = 0,
}: MergeReadinessBadgeProps) {
  const [readiness, setReadiness] = useState<MergeReadiness | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReadiness(null);
    setExpanded(false);
    invoke<MergeReadiness>("cmd_get_merge_readiness", { owner, repo, number })
      .then((result) => {
        if (!cancelled) setReadiness(result);
      })
      .catch(() => {
        // 取得失敗時はバッジ自体を出さない（詳細ページの主要情報ではないため）
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, refreshKey]);

  if (!readiness) return null;

  if (readiness.ready) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: "rgba(74, 222, 128, 0.15)",
          color: "var(--accent-green)",
        }}
        title={`${readiness.approvals} approval(s) · CI ${readiness.ciState ?? "n/a"}`}
      >
        Ready to merge
      </span>
    );
  }

  const [first, ...rest] = readiness.blockers;
  const detailOpen = expanded && hasDetail(readiness);

  return (
    <div className="relative inline-flex flex-col items-start">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.15)",
          color: "var(--accent-orange, #fb923c)",
        }}
        title={readiness.blockers.join(" · ")}
        aria-expanded={detailOpen}
        aria-controls="merge-readiness-detail"
        onClick={() => setExpanded((v) => !v)}
      >
        {first ?? "Not ready"}
        {rest.length > 0 && <span>+{rest.length}</span>}
      </button>
      {detailOpen && (
        <div
          id="merge-readiness-detail"
          role="region"
          aria-label="Merge readiness details"
          className="mt-1 min-w-[200px] rounded-md border px-2.5 py-2 text-[11px]"
          style={{
            backgroundColor: "var(--bg-secondary, #1c1c1e)",
            borderColor: "var(--border-subtle, #333)",
            color: "var(--text-secondary, #a1a1aa)",
          }}
        >
          {readiness.blockingChecks.length > 0 && (
            <div className="mb-2 last:mb-0">
              <div className="mb-1 font-medium" style={{ color: "var(--text-primary, #e4e4e7)" }}>
                Blocking checks
              </div>
              <ul className="space-y-0.5">
                {readiness.blockingChecks.map((check) => (
                  <li key={`${check.name}-${check.conclusion}`}>
                    {check.name}
                    <span className="ml-1 opacity-70">({check.conclusion})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(readiness.requiredReviewsRemaining > 0 || readiness.changesRequested > 0) && (
            <div className="mb-2 last:mb-0">
              <div className="mb-1 font-medium" style={{ color: "var(--text-primary, #e4e4e7)" }}>
                Reviews
              </div>
              <ul className="space-y-0.5">
                {readiness.requiredReviewsRemaining > 0 && (
                  <li>
                    {readiness.requiredReviewsRemaining} required review
                    {readiness.requiredReviewsRemaining === 1 ? "" : "s"} remaining
                  </li>
                )}
                {readiness.changesRequested > 0 && (
                  <li>
                    {readiness.changesRequested} change
                    {readiness.changesRequested === 1 ? "" : "s"} requested
                  </li>
                )}
              </ul>
            </div>
          )}
          {readiness.blockers.some(
            (b) =>
              b !== "CI failing" &&
              b !== "CI running" &&
              b !== "Changes requested" &&
              b !== "No approvals yet",
          ) && (
            <div>
              <div className="mb-1 font-medium" style={{ color: "var(--text-primary, #e4e4e7)" }}>
                Other blockers
              </div>
              <ul className="space-y-0.5">
                {readiness.blockers
                  .filter(
                    (b) =>
                      b !== "CI failing" &&
                      b !== "CI running" &&
                      b !== "Changes requested" &&
                      b !== "No approvals yet",
                  )
                  .map((b) => (
                    <li key={b}>{b}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
