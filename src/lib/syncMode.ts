import type { PollingInterval } from "../stores/settingsStore";

export type SyncMode = "poll" | "push-assisted";

/** When push-assisted and the window is focused, cap the poll interval at 30s. */
export const PUSH_ASSISTED_FOCUSED_POLL_SECONDS = 30;

/** Poll interval while the window is unfocused (per product requirements). */
export const UNFOCUSED_POLL_SECONDS = 300;

const BASE_POLL_SECONDS: Record<Exclude<PollingInterval, "off">, number> = {
  "30s": 30,
  "60s": 60,
  "5m": 300,
};

export function resolveSyncMode(pushSyncEnabled: boolean): SyncMode {
  return pushSyncEnabled ? "push-assisted" : "poll";
}

/** Whether the app window should be treated as focused for sync/polling. */
export function isWindowFocused(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden" && document.hasFocus();
}

/**
 * Effective poll interval in seconds for the current mode/focus.
 * `0` means polling is off.
 *
 * Push-assisted does **not** mean GitHub webhooks — it means focus/resume
 * revalidation plus an optional shorter poll while focused.
 * When unfocused, polling always slows to 5 minutes.
 */
export function effectivePollingSeconds(
  pushSyncEnabled: boolean,
  baseInterval: PollingInterval,
  focused: boolean,
): number {
  if (baseInterval === "off") return 0;
  if (!focused) return UNFOCUSED_POLL_SECONDS;
  const base = BASE_POLL_SECONDS[baseInterval];
  if (pushSyncEnabled) {
    return Math.min(base, PUSH_ASSISTED_FOCUSED_POLL_SECONDS);
  }
  return base;
}
