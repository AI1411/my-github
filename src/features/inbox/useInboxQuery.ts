import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InboxData } from "../../stores/dataStore";
import { reportAuthFailure } from "../../stores/authStore";

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
  const requestIdRef = useRef(0);

  const fetchInbox = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    invoke<InboxData>("cmd_get_inbox")
      .then((d) => {
        if (requestId !== requestIdRef.current) return;
        setData(d);
        // トレイのミニInboxサマリを更新（失敗しても致命的ではない）
        invoke("cmd_update_tray_summary", {
          reviewRequests: d.reviewRequests.length,
          ciFailures: d.ciFailures.length,
          mentions: d.mentions.length,
        }).catch(() => {});
      })
      .catch((e: unknown) => {
        reportAuthFailure(e);
        if (requestId !== requestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return { data, loading, error, refetch: fetchInbox };
}
