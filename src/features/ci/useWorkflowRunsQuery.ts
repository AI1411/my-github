import { useCallback, useEffect, useRef, useState } from "react";
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
  const requestIdRef = useRef(0);

  const fetchRuns = useCallback(() => {
    if (!owner || !repo) {
      setRuns([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    invoke<WorkflowRunSummary[]>("cmd_get_workflow_runs", { owner, repo, branch })
      .then((r) => {
        if (requestId !== requestIdRef.current) return;
        setRuns(r);
      })
      .catch((e: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [owner, repo, branch]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return { runs, loading, error, refetch: fetchRuns };
}
