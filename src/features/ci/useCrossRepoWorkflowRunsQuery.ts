import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorkflowRunSummary } from "../../stores/dataStore";

interface UseCrossRepoWorkflowRunsQueryResult {
  runs: WorkflowRunSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function sortRuns(runs: WorkflowRunSummary[]): WorkflowRunSummary[] {
  return [...runs].sort((a, b) => {
    const aFailed = a.conclusion === "failure" ? 0 : 1;
    const bFailed = b.conclusion === "failure" ? 0 : 1;
    if (aFailed !== bFailed) return aFailed - bFailed;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function useCrossRepoWorkflowRunsQuery(
  repos: string[],
  branch: string | null,
): UseCrossRepoWorkflowRunsQueryResult {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const reposKey = repos.join("\0");

  const fetchRuns = useCallback(() => {
    const repoList = reposKey ? reposKey.split("\0") : [];
    if (repoList.length === 0) {
      setRuns([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const fetches = repoList.map((fullName) => {
      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) return Promise.resolve([] as WorkflowRunSummary[]);
      return invoke<WorkflowRunSummary[]>("cmd_get_workflow_runs", {
        owner,
        repo,
        branch,
      }).catch(() => [] as WorkflowRunSummary[]);
    });

    Promise.all(fetches)
      .then((results) => {
        if (requestId !== requestIdRef.current) return;
        setRuns(sortRuns(results.flat()));
        setError(null);
      })
      .catch((e: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [reposKey, branch]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return { runs, loading, error, refetch: fetchRuns };
}
