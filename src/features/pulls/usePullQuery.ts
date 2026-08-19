import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PullSummary } from "../../stores/dataStore";

export interface UsePullQueryResult {
  pull: PullSummary | null;
  loading: boolean;
  error: string | null;
}

export function usePullQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
  enabled = true,
): UsePullQueryResult {
  const [pull, setPull] = useState<PullSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !owner || !repo || !number) {
      setPull(null);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setPull(null);
    setLoading(true);
    setError(null);
    invoke<PullSummary>("cmd_get_pull", { owner, repo, number })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setPull(result);
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setError(typeof e === "string" ? e : String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [enabled, owner, repo, number]);

  return { pull, loading, error };
}
