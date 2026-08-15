import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PullCheckSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string;
}

interface ChecksTabProps {
  owner: string;
  repo: string;
  number: number;
}

function conclusionColor(conclusion: string | null, status: string): string {
  if (status !== "completed") return "var(--accent-yellow)";
  switch (conclusion) {
    case "success":
      return "var(--accent-green)";
    case "failure":
    case "timed_out":
    case "cancelled":
      return "var(--accent-red)";
    case "skipped":
    case "neutral":
      return "var(--text-muted)";
    default:
      return "var(--text-muted)";
  }
}

function durationLabel(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function ChecksTab({ owner, repo, number }: ChecksTabProps) {
  const [checks, setChecks] = useState<PullCheckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<PullCheckSummary[]>("cmd_list_pull_checks", { owner, repo, number })
      .then((rows) => {
        if (!cancelled) setChecks(rows);
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
        Loading checks…
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
  if (checks.length === 0) {
    return (
      <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
        No check runs
      </p>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
      {checks.map((c) => {
        const duration = durationLabel(c.startedAt, c.completedAt);
        const failed =
          c.status === "completed" &&
          (c.conclusion === "failure" || c.conclusion === "timed_out" || c.conclusion === "cancelled");
        return (
          <li key={c.id} className="px-4 py-3 flex items-center gap-3">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: conclusionColor(c.conclusion, c.status) }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {c.name}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {c.conclusion ?? c.status}
                {duration ? ` · ${duration}` : ""}
              </p>
            </div>
            <a
              href={c.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs shrink-0"
              style={{ color: failed ? "var(--accent-red)" : "var(--accent-blue)" }}
            >
              {failed ? "View logs" : "Details"}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
