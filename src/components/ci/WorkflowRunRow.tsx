import type { WorkflowRunSummary } from "../../stores/dataStore";

function StatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status !== "completed") {
    return (
      <span style={{ color: "var(--accent-orange)" }} aria-label="in-progress">
        ●
      </span>
    );
  }
  if (conclusion === "success") {
    return (
      <span style={{ color: "var(--accent-green)" }} aria-label="success">
        ✓
      </span>
    );
  }
  if (conclusion === "failure") {
    return (
      <span style={{ color: "var(--accent-red)" }} aria-label="failure">
        ✗
      </span>
    );
  }
  return (
    <span style={{ color: "var(--text-muted)" }} aria-label={conclusion ?? "unknown"}>
      ○
    </span>
  );
}

function formatDuration(startedAt: string | null, updatedAt: string): string {
  if (!startedAt) return "—";
  const diffSec = Math.floor(
    (new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (diffSec < 60) return `${diffSec}s`;
  return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
}

interface WorkflowRunRowProps {
  run: WorkflowRunSummary;
  onOpenLogs?: () => void;
  onRerunFailed?: () => void;
  rerunning?: boolean;
}

export function WorkflowRunRow({ run, onOpenLogs, onRerunFailed, rerunning }: WorkflowRunRowProps) {
  return (
    <div
      role="row"
      className="px-4 py-3 flex items-center gap-4 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="w-5 text-center flex-shrink-0 text-sm font-bold">
        <StatusIcon status={run.status} conclusion={run.conclusion} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {run.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {run.repo}
          {" · "}
          {run.headBranch ?? "unknown"}
          {" · "}#{run.runNumber}
        </p>
      </div>
      <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>
        {formatDuration(run.runStartedAt, run.updatedAt)}
      </span>
      {run.conclusion === "failure" && onRerunFailed && (
        <button
          onClick={onRerunFailed}
          disabled={rerunning}
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            cursor: rerunning ? "not-allowed" : "pointer",
            opacity: rerunning ? 0.6 : 1,
          }}
        >
          {rerunning ? "Re-running…" : "Re-run failed"}
        </button>
      )}
      {run.conclusion === "failure" && onOpenLogs && (
        <button
          onClick={onOpenLogs}
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            cursor: "pointer",
          }}
        >
          Logs
        </button>
      )}
    </div>
  );
}
