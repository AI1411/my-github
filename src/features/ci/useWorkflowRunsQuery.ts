import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorkflowRunSummary } from "../../stores/dataStore";

interface UseWorkflowRunsQueryResult {
  runs: WorkflowRunSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorkflowRunsQuery(
  owner: string | null,
  repo: string | null,
  branch: string | null,
): UseWorkflowRunsQueryResult {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetch() {
    if (!owner || !repo) return () => {};
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<WorkflowRunSummary[]>("cmd_get_workflow_runs", { owner, repo, branch })
      .then((r) => { if (!cancelled) setRuns(r); })
      .catch((e: unknown) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }

  useEffect(() => fetch(), [owner, repo, branch]);

  return { runs, loading, error, refetch: fetch };
}
