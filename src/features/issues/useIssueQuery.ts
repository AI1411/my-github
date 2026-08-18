import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getPrefetchPromise } from "../../lib/detailPrefetch";
import type { IssueSummary } from "../../stores/dataStore";

export interface UseIssueQueryResult {
  issue: IssueSummary | null;
  loading: boolean;
  error: string | null;
}

export function useIssueQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
): UseIssueQueryResult {
  const [issue, setIssue] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!owner || !repo || !number) {
      setIssue(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setIssue(null);
    setLoading(true);
    setError(null);
    const request =
      getPrefetchPromise<IssueSummary>("issue", owner, repo, number) ??
      invoke<IssueSummary>("cmd_get_issue", { owner, repo, number });
    void request
      .then((i) => {
        if (requestId !== requestIdRef.current) return;
        setIssue(i);
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setError(typeof e === "string" ? e : String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [owner, repo, number]);

  return { issue, loading, error };
}
