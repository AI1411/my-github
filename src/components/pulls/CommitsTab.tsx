import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PullCommitSummary {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string | null;
  committedAt: string | null;
  htmlUrl: string;
}

interface CommitsTabProps {
  owner: string;
  repo: string;
  number: number;
}

export function CommitsTab({ owner, repo, number }: CommitsTabProps) {
  const [commits, setCommits] = useState<PullCommitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<PullCommitSummary[]>("cmd_list_pull_commits", { owner, repo, number })
      .then((rows) => {
        if (!cancelled) setCommits(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  if (loading) {
    return (
      <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Loading commits…
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-4 py-6 text-sm" style={{ color: "var(--accent-red)" }} role="alert">
        {error}
      </p>
    );
  }
  if (commits.length === 0) {
    return (
      <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
        No commits
      </p>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
      {commits.map((c) => (
        <li key={c.sha} className="px-4 py-3 flex items-start gap-3">
          <code className="text-xs font-mono shrink-0" style={{ color: "var(--accent-blue)" }}>
            <a href={c.htmlUrl} target="_blank" rel="noreferrer">
              {c.sha.slice(0, 7)}
            </a>
          </code>
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate" style={{ color: "var(--text-primary)" }} title={c.message}>
              {c.message}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {c.authorLogin ?? c.authorName ?? "unknown"}
              {c.committedAt ? ` · ${c.committedAt}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
