import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { useInboxQuery } from "../features/inbox/useInboxQuery";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { formatRelativeTime } from "../lib/relativeTime";
import {
  buildReviewQueue,
  nextReviewQueueIndex,
  reviewQueueDetailPath,
  type ReviewQueueEntry,
} from "../lib/reviewQueue";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";

function PriorityBadges({ entry }: { entry: ReviewQueueEntry }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {entry.ciFailing && (
        <span
          className="text-[11px] px-2 py-0.5 rounded"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-red) 20%, transparent)",
            color: "var(--accent-red)",
          }}
        >
          CI failing
        </span>
      )}
      {entry.stale && (
        <span
          className="text-[11px] px-2 py-0.5 rounded"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-yellow, #eab308) 18%, transparent)",
            color: "var(--accent-yellow, #eab308)",
          }}
        >
          Stale
        </span>
      )}
      {!entry.ciFailing && !entry.stale && (
        <span
          className="text-[11px] px-2 py-0.5 rounded"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-muted)",
          }}
        >
          Review requested
        </span>
      )}
    </div>
  );
}

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const { data, loading, error } = useInboxQuery();
  const pulls = useDataStore((s) => s.pulls);
  const staleThresholds = useSettingsStore((s) => s.staleThresholds);
  const [index, setIndex] = useState(0);

  const queue = useMemo(
    () =>
      buildReviewQueue({
        reviewRequests: data?.reviewRequests ?? [],
        pulls,
        thresholds: staleThresholds,
      }),
    [data?.reviewRequests, pulls, staleThresholds],
  );

  useEffect(() => {
    if (queue.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= queue.length) setIndex(queue.length - 1);
  }, [queue.length, index]);

  const current = queue[index] ?? null;
  const remainingAfter = Math.max(0, queue.length - index - 1);

  function goNext() {
    setIndex((i) => nextReviewQueueIndex(i, queue.length));
  }

  function openCurrent() {
    if (!current) return;
    const path = reviewQueueDetailPath(current.item);
    if (path) navigate(path);
  }

  useKeyboardShortcut(
    { key: "]", preventDefault: true },
    () => {
      if (queue.length > 0) goNext();
    },
    {},
  );

  useKeyboardShortcut(
    { key: "n", preventDefault: true },
    () => {
      if (queue.length > 0) goNext();
    },
    {},
  );

  useKeyboardShortcut(
    { key: "Enter", preventDefault: true },
    () => {
      openCurrent();
    },
    {},
  );

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Review queue"
        subtitle="CI failing → stale → others · ] or N for next · Enter to open"
        actions={
          queue.length > 0 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={queue.length <= 1}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                opacity: queue.length <= 1 ? 0.5 : 1,
              }}
              aria-label={`Next (${remainingAfter})`}
            >
              Next ({remainingAfter})
            </button>
          ) : null
        }
      />
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <EmptyState title="Failed to load review queue" subtitle={error} />}
      {data && queue.length === 0 && (
        <EmptyState
          title="Queue is empty"
          subtitle="No review requests right now. Enjoy the calm."
        />
      )}
      {data && current && (
        <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
          <div
            role="article"
            aria-label="Current review queue item"
            className="w-full max-w-xl rounded-lg border p-6"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-default)",
            }}
          >
            <p
              className="text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              {index + 1} of {queue.length}
            </p>
            <h2
              className="text-lg font-semibold mt-2"
              style={{ color: "var(--text-primary)" }}
            >
              {current.item.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {current.item.repo}
              {current.item.number !== null && ` #${current.item.number}`}
              {" · "}
              {formatRelativeTime(current.item.updatedAt)}
            </p>
            <PriorityBadges entry={current} />
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={openCurrent}
                className="text-sm px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: "var(--accent-blue)",
                  color: "var(--text-on-accent, #fff)",
                  border: "none",
                }}
              >
                Open detail
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={queue.length <= 1}
                className="text-sm px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  opacity: queue.length <= 1 ? 0.5 : 1,
                }}
              >
                Next ({remainingAfter})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
