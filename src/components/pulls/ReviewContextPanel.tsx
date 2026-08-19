import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  computeReviewGaps,
  matchCodeowners,
  parseCodeowners,
  uniqueOwners,
  type ReviewGap,
} from "../../lib/codeowners";

export interface ReviewContextPayload {
  requestedReviewers: { login: string; avatarUrl: string }[];
  requestedTeams: { slug: string; name: string; combinedSlug: string }[];
  changedFiles: string[];
  codeownersText: string | null;
  codeownersPath: string | null;
  reviews: { login: string; state: string }[];
}

interface ReviewContextPanelProps {
  owner: string;
  repo: string;
  number: number;
  /** Existing personal review_state from cache (APPROVED / CHANGES_REQUESTED / …). */
  reviewState?: string | null;
}

function latestApprovals(reviews: { login: string; state: string }[]): string[] {
  const byUser = new Map<string, string>();
  for (const r of reviews) {
    byUser.set(r.login.toLowerCase(), r.state.toUpperCase());
  }
  return [...byUser.entries()].filter(([, state]) => state === "APPROVED").map(([login]) => login);
}

export function ReviewContextPanel({ owner, repo, number, reviewState }: ReviewContextPanelProps) {
  const [data, setData] = useState<ReviewContextPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    invoke<ReviewContextPayload>("cmd_get_review_context", { owner, repo, number })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  const derived = useMemo(() => {
    if (!data) return null;
    const rules = data.codeownersText ? parseCodeowners(data.codeownersText) : [];
    const matches = data.changedFiles.map((path) => matchCodeowners(path, rules));
    const requiredOwners = uniqueOwners(matches);
    const gaps = computeReviewGaps({
      requestedReviewers: data.requestedReviewers.map((r) => r.login),
      requestedTeams: data.requestedTeams.map((t) => t.combinedSlug),
      requiredOwners,
      approvedLogins: latestApprovals(data.reviews),
    });
    return { matches, requiredOwners, gaps };
  }, [data]);

  if (error) {
    return (
      <section className="mx-4 my-3 rounded-md border px-3 py-2 text-xs" style={panelStyle}>
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>
          Review context
        </div>
        <p className="mt-1" style={{ color: "var(--accent-red)" }}>
          {error}
        </p>
      </section>
    );
  }

  if (!data || !derived) {
    return (
      <section className="mx-4 my-3 rounded-md border px-3 py-2 text-xs" style={panelStyle}>
        <div style={{ color: "var(--text-muted)" }}>Loading review context…</div>
      </section>
    );
  }

  return (
    <section
      className="mx-4 my-3 rounded-md border px-3 py-2 text-xs"
      style={panelStyle}
      aria-label="CODEOWNERS and team review context"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>
          Review context
        </div>
        {reviewState && (
          <span style={{ color: "var(--text-muted)" }}>Your state: {reviewState}</span>
        )}
      </div>

      <Block title="Requested reviewers">
        {data.requestedReviewers.length === 0 && data.requestedTeams.length === 0 ? (
          <Empty>No pending review requests</Empty>
        ) : (
          <ul className="space-y-0.5">
            {data.requestedReviewers.map((r) => (
              <li key={r.login}>@{r.login}</li>
            ))}
            {data.requestedTeams.map((t) => (
              <li key={t.combinedSlug}>
                @{t.combinedSlug} <span style={{ color: "var(--text-muted)" }}>(team)</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="CODEOWNERS">
        {!data.codeownersText ? (
          <Empty>No CODEOWNERS file found</Empty>
        ) : (
          <>
            <p className="mb-1" style={{ color: "var(--text-muted)" }}>
              from {data.codeownersPath}
            </p>
            {derived.requiredOwners.length === 0 ? (
              <Empty>No owners matched for changed files</Empty>
            ) : (
              <ul className="space-y-0.5">
                {derived.requiredOwners.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Block>

      <Block title="Unmet requirements">
        {derived.gaps.length === 0 ? (
          <Empty>No outstanding CODEOWNERS / team gaps detected</Empty>
        ) : (
          <ul className="space-y-1">
            {derived.gaps.map((g) => (
              <GapRow key={`${g.kind}-${g.name}`} gap={g} />
            ))}
          </ul>
        )}
      </Block>
    </section>
  );
}

function GapRow({ gap }: { gap: ReviewGap }) {
  return (
    <li>
      <span style={{ color: "var(--text-primary)" }}>{gap.name}</span>
      <span className="ml-1" style={{ color: "var(--text-muted)" }}>
        — {gap.reason}
      </span>
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p style={{ color: "var(--text-muted)" }}>{children}</p>;
}

const panelStyle: CSSProperties = {
  backgroundColor: "var(--bg-secondary, #1c1c1e)",
  borderColor: "var(--border-subtle, #333)",
  color: "var(--text-secondary, #a1a1aa)",
};
