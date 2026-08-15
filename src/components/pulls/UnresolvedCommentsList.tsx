import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ReviewCommentSummary } from "./ReviewCommentsPanel";

export interface UnresolvedCommentsListProps {
  owner: string;
  repo: string;
  number: number;
  /** Called when the user clicks a thread — jump to that file in the Files tab. */
  onJumpToFile?: (path: string) => void;
  /** Optional: surface loaded comments to the parent (e.g. for inline FileDiff threads). */
  onCommentsLoaded?: (comments: ReviewCommentSummary[]) => void;
}

function snippet(body: string, max = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

/** Root review comments (no in_reply_to) are treated as open/unresolved threads for MVP. */
export function groupUnresolvedRoots(comments: ReviewCommentSummary[]): ReviewCommentSummary[] {
  return comments.filter((c) => c.inReplyToId == null);
}

export function UnresolvedCommentsList({
  owner,
  repo,
  number,
  onJumpToFile,
  onCommentsLoaded,
}: UnresolvedCommentsListProps) {
  const [comments, setComments] = useState<ReviewCommentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCommentsLoadedRef = useRef(onCommentsLoaded);
  onCommentsLoadedRef.current = onCommentsLoaded;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<ReviewCommentSummary[]>("cmd_list_pull_review_comments", { owner, repo, number })
      .then((list) => {
        if (cancelled) return;
        setComments(list);
        onCommentsLoadedRef.current?.(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  const roots = groupUnresolvedRoots(comments);

  if (loading && comments.length === 0) {
    return (
      <p className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Loading open threads…
      </p>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-2 text-xs" style={{ color: "var(--accent-red)" }} role="alert">
        {error}
      </p>
    );
  }

  if (roots.length === 0) {
    return null;
  }

  return (
    <section className="mx-4 my-3" aria-label="Unresolved comment threads">
      <h2
        className="text-[11px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Open threads ({roots.length})
      </h2>
      <ul className="flex flex-col gap-1.5">
        {roots.map((c) => {
          const location = `${c.path}${c.line != null ? `:${c.line}` : ""}`;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onJumpToFile?.(c.path)}
                className="w-full text-left rounded-md border px-3 py-2 transition-opacity hover:opacity-90"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide shrink-0"
                    style={{ color: "var(--accent-yellow)" }}
                  >
                    Unresolved
                  </span>
                  <span
                    className="font-mono text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                    title={location}
                  >
                    {location}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {snippet(c.body)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
