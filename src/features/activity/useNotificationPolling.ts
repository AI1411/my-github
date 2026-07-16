import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendAppNotification } from "../../lib/notifications";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore, type NotificationSummary } from "../../stores/dataStore";
import { useSettingsStore, type PollingInterval } from "../../stores/settingsStore";

export interface NotificationPollingState {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLLING_INTERVAL_MS: Record<Exclude<PollingInterval, "off">, number> = {
  "30s": 30_000,
  "60s": 60_000,
  "5m": 300_000,
};

export function useNotificationPolling(): NotificationPollingState {
  const accountId = useAuthStore((state) => state.user?.login ?? null);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deliveredIds = useRef(new Set<string>());
  const deliveredAccount = useRef<string | null>(null);
  const generation = useRef(0);

  const fetchNotifications = useCallback(async () => {
    const currentGeneration = generation.current;
    setLoading(true);
    setError(null);
    try {
      const notifications = await invoke<NotificationSummary[]>("cmd_get_notifications");
      if (currentGeneration !== generation.current) return;
      useDataStore.getState().setNotifications(notifications);
      const settings = useSettingsStore.getState().notificationSettings;
      for (const notification of notifications) {
        if (!notification.unread || deliveredIds.current.has(notification.id)) {
          continue;
        }
        try {
          if (await sendAppNotification(notification, settings)) {
            deliveredIds.current.add(notification.id);
          }
        } catch {
          // Delivery failures are retried on a later poll.
        }
      }
    } catch (cause) {
      if (currentGeneration === generation.current) setError(String(cause));
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    if (deliveredAccount.current !== accountId) {
      deliveredIds.current.clear();
      deliveredAccount.current = accountId;
    }
    if (!accountId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await fetchNotifications();
      if (!cancelled && pollingInterval !== "off") {
        timer = setTimeout(poll, POLLING_INTERVAL_MS[pollingInterval]);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      generation.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [accountId, fetchNotifications, pollingInterval]);

  return { loading, error, refetch: () => void fetchNotifications() };
}
