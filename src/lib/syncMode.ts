import type { PollingInterval } from "../stores/settingsStore";

export type SyncMode = "poll" | "push-assisted";

/** When push-assisted and the window is focused, cap the poll interval at 30s. */
export const PUSH_ASSISTED_FOCUSED_POLL_SECONDS = 30;

const BASE_POLL_SECONDS: Record<Exclude<PollingInterval, "off">, number> = {
  "30s": 30,
  "60s": 60,
  "5m": 300,
};

export function resolveSyncMode(pushSyncEnabled: boolean): SyncMode {
  return pushSyncEnabled ? "push-assisted" : "poll";
}

/**
 * Effective poll interval in seconds for the current mode/focus.
 * `0` means polling is off.
 *
 * Push-assisted does **not** mean GitHub webhooks — it means focus/resume
 * revalidation plus an optional shorter poll while focused.
 */
export function effectivePollingSeconds(
  pushSyncEnabled: boolean,
  baseInterval: PollingInterval,
  focused: boolean,
): number {
  if (baseInterval === "off") return 0;
  const base = BASE_POLL_SECONDS[baseInterval];
  if (pushSyncEnabled && focused) {
    return Math.min(base, PUSH_ASSISTED_FOCUSED_POLL_SECONDS);
  }
  return base;
}
