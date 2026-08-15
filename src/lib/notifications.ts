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
 * OS通知は `immediate` のときのみ送る（`digest` / `off` は送らない）。
 */
export function deliveryForKind(
  kind: Exclude<DesktopNotificationKind, null>,
  settings: NotificationSettings,
  repo?: string,
  repoRules?: RepoNotificationRules,
): "immediate" | "digest" | "off" {
  if (!settings.enabled) return "off";
  const global =
    kind === "ciFailure"
      ? settings.ciFailures
      : kind === "reviewRequest"
        ? settings.reviewRequests
        : settings.mentions;
  if (repo && repoRules?.[repo]) {
    const allowed =
      kind === "ciFailure"
        ? repoRules[repo].ciFailures
        : kind === "reviewRequest"
          ? repoRules[repo].reviewRequests
          : repoRules[repo].mentions;
    if (!allowed) return "off";
  }
  return global;
}

export function enabledForKind(
  kind: Exclude<DesktopNotificationKind, null>,
  settings: NotificationSettings,
  repo?: string,
  repoRules?: RepoNotificationRules,
): boolean {
  return deliveryForKind(kind, settings, repo, repoRules) === "immediate";
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

/** 新規リリースのOS通知。種類別設定ではなく専用フラグで制御する。 */
export async function sendReleaseNotification(release: {
  repo: string;
  tagName: string;
  htmlUrl: string;
}): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  sendNotification({
    title: "New release",
    body: `${release.repo} · ${release.tagName}`,
    autoCancel: true,
    group: "pulse-notifications",
  });
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
