import type { NotificationRule, NotificationSettings } from "../stores/settingsStore";

export interface WorkMode {
  id: string;
  name: string;
  /** Default route when activating (e.g. /inbox, /pulls). */
  homePath: string;
  watchedRepositories: string[];
  /** Snapshot of notification rules applied on activate. */
  notificationRules: NotificationRule[];
  /** Optional overlay for global notification toggles. */
  notificationSettings?: Partial<NotificationSettings>;
  /** Saved filter ids to keep highlighted / preferred. */
  savedFilterIds: string[];
}

export function createWorkMode(
  partial: Omit<WorkMode, "id"> & { id?: string },
): WorkMode {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name.trim() || "Untitled mode",
    homePath: partial.homePath || "/inbox",
    watchedRepositories: [...partial.watchedRepositories],
    notificationRules: partial.notificationRules.map((r) => ({ ...r })),
    notificationSettings: partial.notificationSettings
      ? { ...partial.notificationSettings }
      : undefined,
    savedFilterIds: [...partial.savedFilterIds],
  };
}

export function normalizeWorkModes(raw: unknown): WorkMode[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkMode[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    if (!name) continue;
    const homePath =
      typeof source.homePath === "string" && source.homePath.startsWith("/")
        ? source.homePath
        : "/inbox";
    const watchedRepositories = Array.isArray(source.watchedRepositories)
      ? source.watchedRepositories.filter((r): r is string => typeof r === "string")
      : [];
    const savedFilterIds = Array.isArray(source.savedFilterIds)
      ? source.savedFilterIds.filter((r): r is string => typeof r === "string")
      : [];
    const notificationRules = Array.isArray(source.notificationRules)
      ? (source.notificationRules as NotificationRule[])
      : [];
    out.push(
      createWorkMode({
        id: typeof source.id === "string" && source.id ? source.id : crypto.randomUUID(),
        name,
        homePath,
        watchedRepositories,
        notificationRules,
        savedFilterIds,
        notificationSettings:
          source.notificationSettings && typeof source.notificationSettings === "object"
            ? (source.notificationSettings as Partial<NotificationSettings>)
            : undefined,
      }),
    );
  }
  return out;
}
