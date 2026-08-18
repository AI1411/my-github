import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { IssueSummary } from "../../stores/dataStore";
import { useDataStore } from "../../stores/dataStore";
import { reportAuthFailure } from "../../stores/authStore";
import type { IssueFilter } from "./issueFilter";

export interface UseIssuesQueryResult {
  issues: IssueSummary[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useIssuesQuery(filter: IssueFilter): UseIssuesQueryResult {
  const setIssues = useDataStore((s) => s.setIssues);
  const issues = useDataStore((s) => s.issues);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const runQuery = useCallback(
    async (isInitial: boolean) => {
      const requestId = ++requestIdRef.current;
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const result = await invoke<IssueSummary[]>("cmd_list_issues", {
          filter,
        });
        if (requestId !== requestIdRef.current) return;
        setIssues(result);
      } catch (e) {
        reportAuthFailure(e);
        if (requestId !== requestIdRef.current) return;
        setError(typeof e === "string" ? e : String(e));
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, setIssues],
  );

  useEffect(() => {
    void runQuery(true);
    const unlisten = listen("issues-updated", () => {
      void runQuery(false);
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [runQuery]);

  const refetch = useCallback(() => runQuery(false), [runQuery]);

  return { issues, loading, refreshing, error, refetch };
}
