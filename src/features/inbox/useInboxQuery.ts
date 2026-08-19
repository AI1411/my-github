import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InboxData } from "../../stores/dataStore";
import { reportAuthFailure } from "../../stores/authStore";
import { useSequencedRequest } from "../../hooks/useSequencedRequest";

export function useInboxQuery() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { nextRequestId, isCurrentRequest } = useSequencedRequest();

  const fetchInbox = useCallback(() => {
    const requestId = nextRequestId();
    setLoading(true);
    setError(null);
    invoke<InboxData>("cmd_get_inbox")
      .then((d) => {
        if (!isCurrentRequest(requestId)) return;
        setData(d);
        invoke("cmd_update_tray_summary", {
          reviewRequests: d.reviewRequests.length,
          ciFailures: d.ciFailures.length,
          mentions: d.mentions.length,
        }).catch(() => {});
      })
      .catch((e: unknown) => {
        reportAuthFailure(e);
        if (!isCurrentRequest(requestId)) return;
        setError(String(e));
      })
      .finally(() => {
        if (!isCurrentRequest(requestId)) return;
        setLoading(false);
      });
  }, [nextRequestId, isCurrentRequest]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return { data, loading, error, refetch: fetchInbox };
}
