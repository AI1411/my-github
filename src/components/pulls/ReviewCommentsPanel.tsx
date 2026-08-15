import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ReviewCommentSummary {
  id: number;
  userLogin: string;
  body: string;
  path: string;
  htmlUrl: string;
  createdAt: string;
  inReplyToId: number | null;
  hasSuggestion: boolean;
  line: number | null;
}

interface ReviewCommentsPanelProps {
  owner: string;
  repo: string;
  number: number;
}

export function ReviewCommentsPanel({ owner, repo, number }: ReviewCommentsPanelProps) {
  const [comments, setComments] = useState<ReviewCommentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    invoke<ReviewCommentSummary[]>("cmd_list_pull_review_comments", { owner, repo, number })
      .then(setComments)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [owner, repo, number]);

  const roots = comments.filter((c) => !c.inReplyToId);
  const repliesOf = (id: number) => comments.filter((c) => c.inReplyToId === id);

  const reply = async (commentId: number) => {
    const body = replyDrafts[commentId]?.trim();
    if (!body) return;
    setBusyId(commentId);
    setError(null);
    try {
      await invoke("cmd_reply_pull_review_comment", {
        owner,
        repo,
        number,
        commentId,
        body,
      });
      setReplyDrafts((d) => ({ ...d, [commentId]: "" }));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const applySuggestion = async (commentId: number) => {
    setBusyId(commentId);
    setError(null);
    try {
      await invoke("cmd_apply_pull_suggestion", { owner, repo, number, commentId });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && comments.length === 0) {
    return (
      <p className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Loading review comments…
      </p>
    );
  }

  if (roots.length === 0) {
    return null;
  }

  return (
    <section className="mx-4 my-3" aria-label="Review comment threads">
      <h2
        className="text-[11px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Review threads
      </h2>
      {error && (
        <p className="text-xs mb-2" style={{ color: "var(--accent-red)" }} role="alert">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {roots.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-secondary)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {c.userLogin}
              </span>
              <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {c.path}
                {c.line != null ? `:${c.line}` : ""}
              </span>
            </div>
            <pre
              className="text-xs whitespace-pre-wrap mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {c.body}
            </pre>
            <ul className="flex flex-col gap-2 mb-2 pl-3 border-l" style={{ borderColor: "var(--border-subtle)" }}>
              {repliesOf(c.id).map((r) => (
                <li key={r.id}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {r.userLogin}
                  </span>
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {r.body}
                  </pre>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <textarea
                aria-label={`Reply to comment ${c.id}`}
                rows={2}
                value={replyDrafts[c.id] ?? ""}
                onChange={(e) =>
                  setReplyDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                }
                className="w-full rounded-md px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
                placeholder="Reply…"
              />
              <div className="flex items-center justify-end gap-2">
                {c.hasSuggestion && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => void applySuggestion(c.id)}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {busyId === c.id ? "Working…" : "Apply suggestion"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === c.id || !(replyDrafts[c.id] ?? "").trim()}
                  onClick={() => void reply(c.id)}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{
                    backgroundColor: "var(--accent-blue)",
                    color: "#fff",
                    border: "1px solid var(--accent-blue)",
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
