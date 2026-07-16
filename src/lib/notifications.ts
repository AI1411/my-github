import {
  isPermissionGranted,
  onAction,
  registerActionTypes,
  requestPermission,
  sendNotification,
  type Options,
} from "@tauri-apps/plugin-notification";
import type { NotificationSummary } from "../stores/dataStore";
import type { NotificationSettings, RepoNotificationRules } from "../stores/settingsStore";
import {
  notificationKind,
  notificationRoute,
  type DesktopNotificationKind,
} from "./notificationRoutes";

const APP_OPEN_ACTION = "pulse-open";

let activeClickHandler: {
  token: symbol;
  handler: (route: string) => void;
} | null = null;
let clickHandlerRegistration: Promise<void> | null = null;

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

/**
 * リポジトリ別ルールがあればそれを優先し、なければグローバル設定に従う。
 * `settings.enabled` はマスタースイッチとして常に効く。
 */
export function enabledForKind(
  kind: Exclude<DesktopNotificationKind, null>,
  settings: NotificationSettings,
  repo?: string,
  repoRules?: RepoNotificationRules,
): boolean {
  if (!settings.enabled) return false;
  const source = (repo && repoRules?.[repo]) || settings;
  if (kind === "ciFailure") return source.ciFailures;
  if (kind === "reviewRequest") return source.reviewRequests;
  return source.mentions;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function sendAppNotification(
  notification: NotificationSummary,
  settings: NotificationSettings,
  repoRules?: RepoNotificationRules,
): Promise<boolean> {
  const kind = notificationKind(notification);
  if (!kind || !enabledForKind(kind, settings, notification.repo, repoRules)) return false;
  if (!(await ensureNotificationPermission())) return false;

  const route = notificationRoute(notification.htmlUrl);
  const options: Options = {
    title: titleForKind(kind),
    body: `${notification.repo} · ${notification.subjectTitle}`,
    actionTypeId: route ? APP_OPEN_ACTION : undefined,
    autoCancel: true,
    extra: route ? { route } : undefined,
    group: "pulse-notifications",
  };
  sendNotification(options);
  return true;
}

export async function registerAppNotificationClickHandler(
  onOpenRoute: (route: string) => void,
): Promise<() => void> {
  const token = Symbol("notification-click-handler");
  activeClickHandler = { token, handler: onOpenRoute };
  if (!clickHandlerRegistration) {
    const registration = (async () => {
      await registerActionTypes([
        {
          id: APP_OPEN_ACTION,
          actions: [{ id: "open", title: "Open in my-github", foreground: true }],
        },
      ]);
      await onAction((notification) => {
        const route = notification.extra?.route;
        if (typeof route === "string") activeClickHandler?.handler(route);
      });
    })();
    clickHandlerRegistration = registration;
    try {
      await registration;
    } catch (error) {
      if (clickHandlerRegistration === registration) {
        clickHandlerRegistration = null;
      }
      throw error;
    }
  } else {
    await clickHandlerRegistration;
  }

  return () => {
    if (activeClickHandler?.token === token) {
      activeClickHandler = null;
    }
  };
}
