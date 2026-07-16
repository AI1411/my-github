import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NotificationSummary } from "../../stores/dataStore";
import { useDataStore } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { sendAppNotification } from "../../lib/notifications";

interface UseNotificationsQueryResult {
  notifications: NotificationSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const notifiedThreadIds = new Set<string>();

export function useNotificationsQuery(): UseNotificationsQueryResult {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetch() {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<NotificationSummary[]>("cmd_get_notifications")
      .then((ns) => {
        if (cancelled) return;
        setNotifications(ns);
        useDataStore.getState().setNotifications(ns);
        const settings = useSettingsStore.getState().notificationSettings;
        for (const notification of ns) {
          if (!notification.unread || notifiedThreadIds.has(notification.id)) {
            continue;
          }
          notifiedThreadIds.add(notification.id);
          void sendAppNotification(notification, settings);
        }
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

  return { notifications, loading, error, refetch: fetch };
}
