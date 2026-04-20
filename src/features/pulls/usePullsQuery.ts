import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PullSummary } from "../../stores/dataStore";
import { useDataStore } from "../../stores/dataStore";

export type PullTab = "created" | "assigned" | "review" | "mentioned" | "all";

export interface PullFilter {
  tab?: PullTab;
  state?: "open" | "closed";
  repoFullName?: string;
  authorLogin?: string;
  labels?: string[];
}

export interface UsePullsQueryResult {
  pulls: PullSummary[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Query pull requests via `cmd_list_pulls`. Cached rows return immediately;
 * the backend spawns a background refresh and emits `pulls-updated`, which we
 * listen to and re-run the query.
 */
export function usePullsQuery(filter: PullFilter): UsePullsQueryResult {
  const setPulls = useDataStore((s) => s.setPulls);
  const pulls = useDataStore((s) => s.pulls);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const result = await invoke<PullSummary[]>("cmd_list_pulls", {
          filter,
        });
        setPulls(result);
      } catch (e) {
        setError(typeof e === "string" ? e : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, setPulls],
  );

  useEffect(() => {
    void runQuery(true);
    const unlisten = listen("pulls-updated", () => {
      void runQuery(false);
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [runQuery]);

  const refetch = useCallback(() => runQuery(false), [runQuery]);

  return { pulls, loading, refreshing, error, refetch };
}
