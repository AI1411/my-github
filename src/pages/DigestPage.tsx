import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { digestSince, loadDigestLastSeen, saveDigestLastSeen } from "../lib/digest";
import { formatRelativeTime } from "../lib/relativeTime";
import { openInBrowser } from "../lib/openInBrowser";
import type { ReleaseSummary } from "../stores/dataStore";

interface DigestPullItem {
  repo: string;
  number: number;
  title: string;
  htmlUrl: string | null;
  updatedAt: string;
}

interface DigestNotificationItem {
  repo: string | null;
  title: string | null;
  updatedAt: string;
}

interface DigestData {
  mergedPulls: DigestPullItem[];
  ciFailures: DigestPullItem[];
  reviewRequests: DigestNotificationItem[];
  mentions: DigestNotificationItem[];
  releases: ReleaseSummary[];
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div
      className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b flex items-center justify-between"
      style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}
    >
      <span>{title}</span>
      <span>{count}</span>
    </div>
  );
}

function DigestRow({
  primary,
  secondary,
  onOpen,
}: {
  primary: string;
  secondary: string;
  onOpen?: () => void;
}) {
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.();
      }}
      className="px-4 py-2.5 border-b outline-none"
      style={{
        borderColor: "var(--border-subtle)",
        cursor: onOpen ? "pointer" : "default",
      }}
    >
      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
        {primary}
      </p>
      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
        {secondary}
      </p>
    </div>
  );
}

export default function DigestPage() {
  const navigate = useNavigate();
  const [since] = useState(() => digestSince(loadDigestLastSeen(), new Date()));
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoke<DigestData>("cmd_get_digest", { since })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        saveDigestLastSeen(new Date().toISOString());
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [since]);

  const isEmpty =
    data &&
    data.mergedPulls.length === 0 &&
    data.ciFailures.length === 0 &&
    data.reviewRequests.length === 0 &&
    (data.mentions?.length ?? 0) === 0 &&
    data.releases.length === 0;

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Digest"
        subtitle={`Since ${new Date(since).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        actions={
          <button
            type="button"
            onClick={() => navigate("/inbox")}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Skip to Inbox
          </button>
        }
      />
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <EmptyState title="Failed to load digest" subtitle={error} />}
      {isEmpty && (
        <EmptyState title="Nothing new" subtitle="No merges, CI failures, reviews, or releases" />
      )}
      {data && !isEmpty && (
        <div className="flex-1 overflow-y-auto">
          {data.reviewRequests.length > 0 && (
            <>
              <SectionHeading title="New review requests" count={data.reviewRequests.length} />
              {data.reviewRequests.map((item, index) => (
                <DigestRow
                  key={`${item.repo}-${index}`}
                  primary={item.title ?? "(untitled)"}
                  secondary={`${item.repo ?? "unknown"} · ${formatRelativeTime(item.updatedAt)}`}
                />
              ))}
            </>
          )}
          {(data.mentions?.length ?? 0) > 0 && (
            <>
              <SectionHeading title="Mentions" count={data.mentions.length} />
              {data.mentions.map((item, index) => (
                <DigestRow
                  key={`mention-${item.repo}-${index}`}
                  primary={item.title ?? "(untitled)"}
                  secondary={`${item.repo ?? "unknown"} · ${formatRelativeTime(item.updatedAt)}`}
                />
              ))}
            </>
          )}
          {data.ciFailures.length > 0 && (
            <>
              <SectionHeading title="CI failing" count={data.ciFailures.length} />
              {data.ciFailures.map((item) => (
                <DigestRow
                  key={`ci-${item.repo}-${item.number}`}
                  primary={item.title}
                  secondary={`${item.repo} #${item.number} · ${formatRelativeTime(item.updatedAt)}`}
                  onOpen={item.htmlUrl ? () => void openInBrowser(item.htmlUrl!) : undefined}
                />
              ))}
            </>
          )}
          {data.mergedPulls.length > 0 && (
            <>
              <SectionHeading title="Merged" count={data.mergedPulls.length} />
              {data.mergedPulls.map((item) => (
                <DigestRow
                  key={`merged-${item.repo}-${item.number}`}
                  primary={item.title}
                  secondary={`${item.repo} #${item.number} · ${formatRelativeTime(item.updatedAt)}`}
                  onOpen={item.htmlUrl ? () => void openInBrowser(item.htmlUrl!) : undefined}
                />
              ))}
            </>
          )}
          {data.releases.length > 0 && (
            <>
              <SectionHeading title="New releases" count={data.releases.length} />
              {data.releases.map((release) => (
                <DigestRow
                  key={`release-${release.id}`}
                  primary={release.name ?? release.tagName}
                  secondary={`${release.repo} · ${release.tagName}`}
                  onOpen={() => void openInBrowser(release.htmlUrl)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
