import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendAppNotification } from "../../lib/notifications";
import { effectivePollingSeconds } from "../../lib/syncMode";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore, type NotificationSummary } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";

export interface NotificationPollingState {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useDocumentFocused(): boolean {
  const [focused, setFocused] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );
  useEffect(() => {
    const update = () => setFocused(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return focused;
}

export function useNotificationPolling(): NotificationPollingState {
  const accountId = useAuthStore((state) => state.user?.login ?? null);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const pushSyncEnabled = useSettingsStore((state) => state.pushSyncEnabled);
  const focused = useDocumentFocused();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deliveredIds = useRef(new Set<string>());
  const deliveringIds = useRef(new Map<string, number>());
  const deliveredAccount = useRef<string | null>(null);
  const generation = useRef(0);
  const requestSequence = useRef(0);
  const pollSeconds = effectivePollingSeconds(pushSyncEnabled, pollingInterval, focused);

  const fetchNotifications = useCallback(async () => {
    const currentGeneration = generation.current;
    const currentRequest = ++requestSequence.current;
    const isLatestRequest = () =>
      currentGeneration === generation.current && currentRequest === requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const notifications = await invoke<NotificationSummary[]>("cmd_get_notifications");
      if (!isLatestRequest()) return;
      useDataStore.getState().setNotifications(notifications);
      const settings = useSettingsStore.getState().notificationSettings;
      const repoRules = useSettingsStore.getState().repoNotificationRules;
      const notificationRules = useSettingsStore.getState().notificationRules;
      for (const notification of notifications) {
        if (!isLatestRequest()) return;
        if (
          !notification.unread ||
          deliveredIds.current.has(notification.id) ||
          deliveringIds.current.has(notification.id)
        ) {
          continue;
        }
        if (!isLatestRequest()) return;
        deliveringIds.current.set(notification.id, currentGeneration);
        try {
          const sent = await sendAppNotification(
            notification,
            settings,
            repoRules,
            notificationRules,
            useSettingsStore.getState().quietHours,
          );
          if (currentGeneration !== generation.current) return;
          if (sent) {
            deliveredIds.current.add(notification.id);
          }
        } catch {
          // Delivery failures are retried on a later poll.
        } finally {
          if (deliveringIds.current.get(notification.id) === currentGeneration) {
            deliveringIds.current.delete(notification.id);
          }
        }
      }
    } catch (cause) {
      if (isLatestRequest()) setError(String(cause));
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    if (deliveredAccount.current !== accountId) {
      deliveredIds.current.clear();
      deliveringIds.current.clear();
      deliveredAccount.current = accountId;
    }
    return () => {
      generation.current += 1;
    };
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await fetchNotifications();
      if (!cancelled && pollSeconds > 0) {
        timer = setTimeout(poll, pollSeconds * 1000);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [accountId, fetchNotifications, pollSeconds]);

  return { loading, error, refetch: () => void fetchNotifications() };
}
