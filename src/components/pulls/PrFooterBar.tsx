import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../common/Button";
import { checkoutCommand, copyToClipboard } from "../../lib/checkout";

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface PrFooterBarProps {
  owner: string;
  repo: string;
  number: number;
  canMerge: boolean;
  canApprove: boolean;
  canClose?: boolean;
  canReopen?: boolean;
  canToggleDraft?: boolean;
  isDraft?: boolean;
  approveDisabledReason?: string | null;
  htmlUrl: string;
  onOpenInEditor?: () => void;
  checkout?: { number: number; headRef: string };
  onReviewSubmitted?: (event: ReviewEvent, reviewState: string | null) => void;
  onMerged?: () => void;
  onStateChanged?: (state: "open" | "closed") => void;
  onDraftChanged?: (draft: boolean) => void;
}

async function openBrowser(url: string) {
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } catch {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }
}

export function PrFooterBar({
  owner,
  repo,
  number,
  canMerge,
  canApprove,
  canClose = false,
  canReopen = false,
  canToggleDraft = false,
  isDraft = false,
  approveDisabledReason,
  htmlUrl,
  onOpenInEditor,
  checkout,
  onReviewSubmitted,
  onMerged,
  onStateChanged,
  onDraftChanged,
}: PrFooterBarProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<{ event: ReviewEvent; body?: string } | null>(
    null,
  );
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopyCheckout = async () => {
    if (!checkout) return;
    const ok = await copyToClipboard(checkoutCommand(checkout.number, checkout.headRef));
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const submitReview = async (event: ReviewEvent, body?: string) => {
    setBusy(event);
    setError(null);
    try {
      const result = await invoke<{ event: string; reviewState: string | null }>(
        "cmd_submit_pull_review",
        { owner, repo, number, event, body: body ?? null },
      );
      setLastFailed(null);
      onReviewSubmitted?.(event, result.reviewState);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setLastFailed({ event, body });
    } finally {
      setBusy(null);
    }
  };

  const mergePull = async () => {
    setBusy("merge");
    setError(null);
    try {
      await invoke("cmd_merge_pull", { owner, repo, number, mergeMethod: "merge" });
      onMerged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setPullState = async (state: "open" | "closed") => {
    setBusy(state);
    setError(null);
    try {
      await invoke("cmd_set_pull_state", { owner, repo, number, state });
      onStateChanged?.(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setDraft = async (draft: boolean) => {
    setBusy(draft ? "draft" : "ready");
    setError(null);
    try {
      await invoke("cmd_set_pull_draft", { owner, repo, number, draft });
      onDraftChanged?.(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <footer
      className="flex flex-col gap-2 px-4 py-3 border-t"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {error && (
        <div
          className="flex items-center justify-between gap-2 text-xs rounded-md px-2.5 py-2"
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.12)",
            color: "var(--accent-red)",
            border: "1px solid rgba(248, 113, 113, 0.35)",
          }}
          role="alert"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <div className="flex items-center gap-2 shrink-0">
            {lastFailed && (
              <button
                type="button"
                className="underline"
                onClick={() => void submitReview(lastFailed.event, lastFailed.body)}
              >
                Retry
              </button>
            )}
            {htmlUrl && (
              <button
                type="button"
                className="underline"
                onClick={() => void openBrowser(`${htmlUrl}#review`)}
              >
                Open on GitHub
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {checkout && (
          <Button
            variant="ghost"
            onClick={() => void handleCopyCheckout()}
            title={checkoutCommand(checkout.number, checkout.headRef)}
          >
            {copied ? "Copied!" : "Copy checkout"}
          </Button>
        )}
        {onOpenInEditor && (
          <Button variant="ghost" onClick={onOpenInEditor}>
            Open in editor
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={!canApprove || busy !== null}
          onClick={() => void submitReview("REQUEST_CHANGES", "Requested changes")}
          title={approveDisabledReason ?? "Submit request changes review"}
        >
          {busy === "REQUEST_CHANGES" ? "Submitting…" : "Request changes"}
        </Button>
        <Button
          variant="ghost"
          disabled={!canApprove || busy !== null}
          onClick={() => void submitReview("APPROVE")}
          title={approveDisabledReason ?? "Approve this pull request"}
        >
          {busy === "APPROVE" ? "Submitting…" : "Approve"}
        </Button>
        {canToggleDraft && (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void setDraft(!isDraft)}
            title={isDraft ? "Mark ready for review" : "Convert to draft"}
          >
            {busy === "draft" || busy === "ready"
              ? "Updating…"
              : isDraft
                ? "Ready for review"
                : "Convert to draft"}
          </Button>
        )}
        {canClose && (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void setPullState("closed")}
            title="Close pull request"
          >
            {busy === "closed" ? "Closing…" : "Close"}
          </Button>
        )}
        {canReopen && (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void setPullState("open")}
            title="Reopen pull request"
          >
            {busy === "open" ? "Reopening…" : "Reopen"}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!canMerge || busy !== null}
          onClick={() => void mergePull()}
          title="Merge pull request"
        >
          {busy === "merge" ? "Merging…" : "Merge"}
        </Button>
      </div>
    </footer>
  );
}
