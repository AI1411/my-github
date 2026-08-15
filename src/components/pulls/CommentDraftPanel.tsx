import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { copyToClipboard } from "../../lib/checkout";
import { formatReviewComment, REVIEW_PREFIXES, type ReviewPrefixId } from "../../lib/reviewPrefix";

interface CommentDraftPanelProps {
  owner: string;
  repo: string;
  number: number;
  htmlUrl: string | null;
  canComment?: boolean;
  disabledReason?: string | null;
  onSubmitted?: () => void;
}

async function openBrowser(url: string) {
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } catch {
    if (typeof window !== "undefined") window.open(url, "_blank");
  }
}

/**
 * prefix付きレビューコメントの下書きパネル。
 * Submit comment で COMMENT レビューを投稿する。
 */
export function CommentDraftPanel({
  owner,
  repo,
  number,
  htmlUrl,
  canComment = true,
  disabledReason,
  onSubmitted,
}: CommentDraftPanelProps) {
  const [prefix, setPrefix] = useState<ReviewPrefixId>("imo");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const formatted = formatReviewComment(prefix, body);

  const handleCopy = async () => {
    const ok = await copyToClipboard(formatted);
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!body.trim()) {
      setError("Comment body is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await invoke("cmd_submit_pull_review", {
        owner,
        repo,
        number,
        event: "COMMENT",
        body: formatted,
      });
      setBody("");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Comment draft"
      className="mx-4 my-3 rounded-lg border"
      style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-b"
        style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}
      >
        Comment draft
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_PREFIXES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPrefix(option.id)}
              title={option.description}
              className="rounded-md px-2 py-1 font-mono text-xs"
              style={{
                backgroundColor: prefix === option.id ? "var(--accent-blue)" : "var(--bg-tertiary)",
                color: prefix === option.id ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          aria-label="Comment body"
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          placeholder="レビューコメントを書く…"
          rows={3}
          className="w-full resize-y rounded-md px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        />
        {error && (
          <div className="flex items-center justify-between gap-2 text-xs" role="alert">
            <span style={{ color: "var(--accent-red)" }}>{error}</span>
            <button type="button" className="underline" onClick={() => void handleSubmit()}>
              Retry
            </button>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            {copied ? "Copied!" : "Copy draft"}
          </button>
          <button
            type="button"
            disabled={!canComment || busy || !body.trim()}
            title={disabledReason ?? "Submit comment review"}
            onClick={() => void handleSubmit()}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: canComment ? "var(--accent-blue)" : "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: canComment ? "#fff" : "var(--text-muted)",
              opacity: !canComment || busy || !body.trim() ? 0.6 : 1,
            }}
          >
            {busy ? "Submitting…" : "Submit comment"}
          </button>
          {htmlUrl && (
            <button
              type="button"
              onClick={() => void openBrowser(htmlUrl)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              Open in browser
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
