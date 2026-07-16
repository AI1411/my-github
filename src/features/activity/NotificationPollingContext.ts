import { createContext, useContext } from "react";
import type { NotificationPollingState } from "./useNotificationPolling";

export const NotificationPollingContext = createContext<NotificationPollingState | null>(null);

export function useNotificationPollingContext(): NotificationPollingState {
  const value = useContext(NotificationPollingContext);
  if (!value) {
    throw new Error("useNotificationPollingContext must be used within AppShell");
  }
  return value;
}
