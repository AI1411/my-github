import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CrossAccountInboxItem } from "../../stores/dataStore";
import { reportAuthFailure } from "../../stores/authStore";
import { useSequencedRequest } from "../../hooks/useSequencedRequest";

/**
 * Cache-only Inbox items across every cached account, for the Inbox "All
 * accounts" toggle. Unlike `useInboxQuery`, this never hits the GitHub API
 * (so non-active accounts can be shown without switching to them).
 */
export function useCrossAccountInboxQuery(enabled: boolean) {
  const [items, setItems] = useState<CrossAccountInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { nextRequestId, isCurrentRequest } = useSequencedRequest();

  const fetchItems = useCallback(() => {
    if (!enabled) return;
    const requestId = nextRequestId();
    setLoading(true);
    setError(null);
    invoke<CrossAccountInboxItem[]>("cmd_get_cross_account_inbox")
      .then((rows) => {
        if (!isCurrentRequest(requestId)) return;
        setItems(Array.isArray(rows) ? rows : []);
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
  }, [enabled, nextRequestId, isCurrentRequest]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    fetchItems();
  }, [enabled, fetchItems]);

  return { items, loading, error, refetch: fetchItems };
}
