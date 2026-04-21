import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NotificationSummary } from "../../stores/dataStore";

interface UseNotificationsQueryResult {
  notifications: NotificationSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNotificationsQuery(): UseNotificationsQueryResult {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetch() {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<NotificationSummary[]>("cmd_get_notifications")
      .then((ns) => { if (!cancelled) setNotifications(ns); })
      .catch((e: unknown) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }

  useEffect(() => fetch(), []);

  return { notifications, loading, error, refetch: fetch };
}
