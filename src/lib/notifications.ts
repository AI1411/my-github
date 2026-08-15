import {
  isPermissionGranted,
  onAction,
  registerActionTypes,
  requestPermission,
  sendNotification,
  type Options,
} from "@tauri-apps/plugin-notification";
import type { NotificationSummary } from "../stores/dataStore";
import type {
  NotificationDelivery,
  NotificationRule,
  NotificationRuleKind,
  NotificationSettings,
  RepoNotificationRules,
} from "../stores/settingsStore";
import {
  notificationKind,
  notificationRoute,
  type DesktopNotificationKind,
} from "./notificationRoutes";
import { isInQuietHours, type QuietHours } from "./quietHours";

const APP_OPEN_ACTION = "pulse-open";

let activeClickHandler: {
  token: symbol;
  handler: (route: string) => void;
} | null = null;
let clickHandlerRegistration: Promise<void> | null = null;

export const NOTIFICATION_GROUP_WINDOW_MS = 60_000;

type NotificationKind = Exclude<DesktopNotificationKind, null>;

function titleForKind(kind: NotificationKind): string {
  switch (kind) {
    case "ciFailure":
      return "CI failed";
    case "reviewRequest":
      return "Review requested";
    case "mention":
      return "Mention";
  }
}

function groupBodyForKind(kind: NotificationKind, count: number): string {
  const label =
    kind === "ciFailure" ? "CI failing" : kind === "reviewRequest" ? "Review requested" : "Mention";
  return `${label} ×${count}`;
}

interface NotificationGroup {
  kind: NotificationKind;
  count: number;
  sample: NotificationSummary;
  quietHours?: QuietHours;
  timer: ReturnType<typeof setTimeout>;
}

const pendingGroups = new Map<string, NotificationGroup>();

function groupKey(repo: string, kind: NotificationKind): string {
  return `${repo}::${kind}`;
}

function quietHoursActive(quietHours?: QuietHours, now = new Date()): boolean {
  return Boolean(quietHours && isInQuietHours(now, quietHours));
}

function emitGroup(group: NotificationGroup): void {
  if (quietHoursActive(group.quietHours)) return;
  const route = notificationRoute(group.sample.htmlUrl);
  const options: Options = {
    title: titleForKind(group.kind),
    body:
      group.count > 1
        ? groupBodyForKind(group.kind, group.count)
        : `${group.sample.repo} · ${group.sample.subjectTitle}`,
    actionTypeId: route ? APP_OPEN_ACTION : undefined,
    autoCancel: true,
    extra: route ? { route } : undefined,
    group: "pulse-notifications",
  };
  sendNotification(options);
}

export function resetNotificationGroupsForTests(): void {
  for (const group of pendingGroups.values()) {
    clearTimeout(group.timer);
  }
  pendingGroups.clear();
}

function settingsKeyForKind(kind: Exclude<DesktopNotificationKind, null>): NotificationRuleKind {
  switch (kind) {
    case "ciFailure":
      return "ciFailures";
    case "reviewRequest":
      return "reviewRequests";
    case "mention":
      return "mentions";
  }
}

export interface PriorityForKindOptions {
  repo?: string;
  /** repo × kind × priority ルール（優先）。 */
  notificationRules?: NotificationRule[];
  /** 旧 boolean リポジトリルール（後方互換）。 */
  repoRules?: RepoNotificationRules;
}

/**
 * リポジトリ別ルールがあればそれを優先し、なければグローバル設定に従う。
 * `settings.enabled` はマスタースイッチとして常に効く。
 * 解決順: notificationRules → repoNotificationRules → global。
 */
export function priorityForKind(
  kind: NotificationKind,
  settings: NotificationSettings,
  options: PriorityForKindOptions = {},
): NotificationDelivery {
  if (!settings.enabled) return "off";

  const key = settingsKeyForKind(kind);
  const global = settings[key];
  const { repo, notificationRules, repoRules } = options;

  if (repo && notificationRules?.length) {
    const match = notificationRules.find((rule) => rule.repo === repo && rule.kind === key);
    if (match) return match.priority;
  }

  if (repo && repoRules?.[repo]) {
    const allowed = repoRules[repo][key];
    if (!allowed) return "off";
  }

  return global;
}

/** @deprecated Use {@link priorityForKind}. Kept for call-site compatibility. */
export function deliveryForKind(
  kind: NotificationKind,
  settings: NotificationSettings,
  repo?: string,
  repoRules?: RepoNotificationRules,
  notificationRules?: NotificationRule[],
): NotificationDelivery {
  return priorityForKind(kind, settings, { repo, repoRules, notificationRules });
}

export function enabledForKind(
  kind: NotificationKind,
  settings: NotificationSettings,
  repo?: string,
  repoRules?: RepoNotificationRules,
  notificationRules?: NotificationRule[],
): boolean {
  return priorityForKind(kind, settings, { repo, repoRules, notificationRules }) === "immediate";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function sendAppNotification(
  notification: NotificationSummary,
  settings: NotificationSettings,
  repoRules?: RepoNotificationRules,
  notificationRules?: NotificationRule[],
  quietHours?: QuietHours,
): Promise<boolean> {
  const kind = notificationKind(notification);
  if (!kind || !enabledForKind(kind, settings, notification.repo, repoRules, notificationRules)) {
    return false;
  }
  if (quietHoursActive(quietHours)) return false;
  if (!(await ensureNotificationPermission())) return false;

  const key = groupKey(notification.repo, kind);
  const existing = pendingGroups.get(key);
  if (existing) {
    existing.count += 1;
    existing.sample = notification;
    existing.quietHours = quietHours;
    return true;
  }

  const group: NotificationGroup = {
    kind,
    count: 1,
    sample: notification,
    quietHours,
    timer: setTimeout(() => {
      const pending = pendingGroups.get(key);
      pendingGroups.delete(key);
      if (pending) emitGroup(pending);
    }, NOTIFICATION_GROUP_WINDOW_MS),
  };
  pendingGroups.set(key, group);
  return true;
}

/** 新規リリースのOS通知。種類別設定ではなく専用フラグで制御する。 */
export async function sendReleaseNotification(
  release: {
    repo: string;
    tagName: string;
    htmlUrl: string;
  },
  quietHours?: QuietHours,
): Promise<boolean> {
  if (quietHoursActive(quietHours)) return false;
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
