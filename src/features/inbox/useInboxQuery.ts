import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InboxData } from "../../stores/dataStore";

interface UseInboxQueryResult {
  data: InboxData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInboxQuery(): UseInboxQueryResult {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetch() {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<InboxData>("cmd_get_inbox")
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // トレイのミニInboxサマリを更新（失敗しても致命的ではない）
        invoke("cmd_update_tray_summary", {
          reviewRequests: d.reviewRequests.length,
          ciFailures: d.ciFailures.length,
          mentions: d.mentions.length,
        }).catch(() => {});
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => fetch(), []);

  return { data, loading, error, refetch: fetch };
}
