import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface MergeReadiness {
  mergeable: boolean | null;
  mergeableState: string | null;
  approvals: number;
  changesRequested: number;
  ciState: string | null;
  isDraft: boolean;
  ready: boolean;
  blockers: string[];
}

interface MergeReadinessBadgeProps {
  owner: string;
  repo: string;
  number: number;
  refreshKey?: number;
}

export function MergeReadinessBadge({ owner, repo, number, refreshKey = 0 }: MergeReadinessBadgeProps) {
  const [readiness, setReadiness] = useState<MergeReadiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReadiness(null);
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
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(251, 146, 60, 0.15)",
        color: "var(--accent-orange, #fb923c)",
      }}
      title={readiness.blockers.join(" · ")}
    >
      {first ?? "Not ready"}
      {rest.length > 0 && <span>+{rest.length}</span>}
    </span>
  );
}
