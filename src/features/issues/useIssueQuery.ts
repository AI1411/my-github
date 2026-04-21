import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

  useEffect(() => {
    if (!owner || !repo || !number) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<IssueSummary>("cmd_get_issue", { owner, repo, number })
      .then((i) => {
        if (!cancelled) setIssue(i);
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === "string" ? e : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  return { issue, loading, error };
}
