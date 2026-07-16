import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "../../lib/checkout";
import { formatReviewComment, REVIEW_PREFIXES, type ReviewPrefixId } from "../../lib/reviewPrefix";

interface CommentDraftPanelProps {
  htmlUrl: string | null;
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
 * v0.1は書き込みAPIを持たないため、コピーしてブラウザ側で貼り付ける動線。
 */
export function CommentDraftPanel({ htmlUrl }: CommentDraftPanelProps) {
  const [prefix, setPrefix] = useState<ReviewPrefixId>("imo");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopy = async () => {
    const ok = await copyToClipboard(formatReviewComment(prefix, body));
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
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
          {htmlUrl && (
            <button
              type="button"
              onClick={() => void openBrowser(htmlUrl)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--accent-blue)",
                border: "1px solid var(--accent-blue)",
                color: "#fff",
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
