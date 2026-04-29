import {
  isPermissionGranted,
  onAction,
  registerActionTypes,
  requestPermission,
  sendNotification,
  type Options,
} from "@tauri-apps/plugin-notification";
import type { NotificationSummary } from "../stores/dataStore";
import type { NotificationSettings } from "../stores/settingsStore";
import {
  notificationKind,
  notificationRoute,
  type DesktopNotificationKind,
} from "./notificationRoutes";

const PULSE_OPEN_ACTION = "pulse-open";

let clickHandlerRegistered = false;

function titleForKind(kind: Exclude<DesktopNotificationKind, null>): string {
  switch (kind) {
    case "ciFailure":
      return "CI failed";
    case "reviewRequest":
      return "Review requested";
    case "mention":
      return "Mention";
  }
}

function enabledForKind(
  kind: Exclude<DesktopNotificationKind, null>,
  settings: NotificationSettings,
): boolean {
  if (!settings.enabled) return false;
  if (kind === "ciFailure") return settings.ciFailures;
  if (kind === "reviewRequest") return settings.reviewRequests;
  return settings.mentions;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function sendPulseNotification(
  notification: NotificationSummary,
  settings: NotificationSettings,
): Promise<boolean> {
  const kind = notificationKind(notification);
  if (!kind || !enabledForKind(kind, settings)) return false;
  if (!(await ensureNotificationPermission())) return false;

  const route = notificationRoute(notification.htmlUrl);
  const options: Options = {
    title: titleForKind(kind),
    body: `${notification.repo} · ${notification.subjectTitle}`,
    actionTypeId: route ? PULSE_OPEN_ACTION : undefined,
    autoCancel: true,
    extra: route ? { route } : undefined,
    group: "pulse-notifications",
  };
  sendNotification(options);
  return true;
}

export async function registerPulseNotificationClickHandler(
  onOpenRoute: (route: string) => void,
): Promise<void> {
  if (clickHandlerRegistered) return;
  await registerActionTypes([
    {
      id: PULSE_OPEN_ACTION,
      actions: [{ id: "open", title: "Open in Pulse", foreground: true }],
    },
  ]);
  await onAction((notification) => {
    const route = notification.extra?.route;
    if (typeof route === "string") onOpenRoute(route);
  });
  clickHandlerRegistered = true;
}
