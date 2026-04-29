import { getCurrentWindow } from "@tauri-apps/api/window";

export async function updateUnreadBadge(
  unreadCount: number,
  enabled: boolean,
): Promise<void> {
  const badgeCount = enabled && unreadCount > 0 ? unreadCount : undefined;
  try {
    await getCurrentWindow().setBadgeCount(badgeCount);
  } catch {
    // Badge APIs are platform-dependent. Keep the app usable when unsupported.
  }
}
