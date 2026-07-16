export type DesktopNotificationKind = "ciFailure" | "reviewRequest" | "mention" | null;

export interface NotificationRouteSource {
  reason: string;
  subjectType: string;
}

export function notificationRoute(htmlUrl: string | null): string | null {
  if (!htmlUrl) return null;
  const match = htmlUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, type, number] = match;
  return type === "pull"
    ? `/pulls/${owner}/${repo}/${number}`
    : `/issues/${owner}/${repo}/${number}`;
}

export function notificationKind(notification: NotificationRouteSource): DesktopNotificationKind {
  if (notification.reason === "review_requested") return "reviewRequest";
  if (notification.reason === "mention") return "mention";
  if (
    notification.reason === "ci_failure" ||
    notification.reason === "ci_activity" ||
    notification.subjectType === "CheckSuite"
  ) {
    return "ciFailure";
  }
  return null;
}
