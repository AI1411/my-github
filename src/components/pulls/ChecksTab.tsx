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

export interface CheckFailureExcerpt {
  checkRunId: number;
  name: string;
  htmlUrl: string;
  title: string | null;
  summary: string | null;
  textExcerpt: string | null;
  truncated: boolean;
  annotations: Array<{
    path: string;
    startLine: number | null;
    level: string | null;
    message: string;
  }>;
  note: string | null;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [excerpts, setExcerpts] = useState<Record<number, CheckFailureExcerpt | { error: string }>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    setExcerpts({});
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

  async function toggleExcerpt(check: PullCheckSummary) {
    if (expandedId === check.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(check.id);
    if (excerpts[check.id]) return;
    try {
      const excerpt = await invoke<CheckFailureExcerpt>("cmd_get_check_failure_excerpt", {
        owner,
        repo,
        checkRunId: check.id,
      });
      setExcerpts((prev) => ({ ...prev, [check.id]: excerpt }));
    } catch (e) {
      setExcerpts((prev) => ({
        ...prev,
        [check.id]: { error: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

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
          (c.conclusion === "failure" ||
            c.conclusion === "timed_out" ||
            c.conclusion === "cancelled");
        const open = expandedId === c.id;
        const excerpt = excerpts[c.id];
        return (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
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
              {failed && (
                <button
                  type="button"
                  className="text-xs shrink-0"
                  style={{ color: "var(--accent-orange, #fb923c)" }}
                  aria-expanded={open}
                  onClick={() => void toggleExcerpt(c)}
                >
                  {open ? "Hide excerpt" : "Show excerpt"}
                </button>
              )}
              <a
                href={c.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs shrink-0"
                style={{ color: failed ? "var(--accent-red)" : "var(--accent-blue)" }}
              >
                {failed ? "Full logs" : "Details"}
              </a>
            </div>
            {open && (
              <div
                className="mt-2 rounded-md border px-3 py-2 text-[11px]"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
                aria-label={`Failure excerpt for ${c.name}`}
              >
                {!excerpt && <p style={{ color: "var(--text-muted)" }}>Loading excerpt…</p>}
                {excerpt && "error" in excerpt && (
                  <p role="alert" style={{ color: "var(--accent-red)" }}>
                    {excerpt.error}
                  </p>
                )}
                {excerpt && !("error" in excerpt) && (
                  <>
                    {excerpt.title && (
                      <p className="mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
                        {excerpt.title}
                      </p>
                    )}
                    {excerpt.annotations.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {excerpt.annotations.map((a, i) => (
                          <li key={`${a.path}-${i}`}>
                            <span style={{ color: "var(--text-primary)" }}>
                              {a.path}
                              {a.startLine !== null ? `:${a.startLine}` : ""}
                            </span>
                            {a.message ? ` — ${a.message}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(excerpt.summary || excerpt.textExcerpt) && (
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
                        {excerpt.textExcerpt ?? excerpt.summary}
                      </pre>
                    )}
                    {excerpt.note && (
                      <p className="mt-2" style={{ color: "var(--text-muted)" }}>
                        {excerpt.note}
                      </p>
                    )}
                    <a
                      href={excerpt.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block"
                      style={{ color: "var(--accent-blue)" }}
                    >
                      Open full logs on GitHub
                    </a>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
