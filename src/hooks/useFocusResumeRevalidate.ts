import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../stores/uiStore";

const MIN_RESUME_GAP_MS = 5_000;

/**
 * On focus/visibility resume, kick a background sync unless rate-limited.
 * UI keeps showing cached data; sync updates stores asynchronously.
 *
 * This is the desktop stand-in for push/webhook freshness: real inbound
 * GitHub webhooks are not implemented. When Settings → Notifications has
 * **Push-assisted sync** enabled, this focus/resume path is the primary
 * way data catches up (paired with a shorter poll while focused).
 */
export function useFocusResumeRevalidate(onResume?: () => void): void {
  const rateLimitHit = useUiStore((s) => s.rateLimitHit);
  const lastResumeAt = useRef(0);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== "visible") return;
      if (rateLimitHit) return;
      const now = Date.now();
      if (now - lastResumeAt.current < MIN_RESUME_GAP_MS) return;
      lastResumeAt.current = now;
      onResume?.();
      // Always revalidate on focus; push-assisted mode treats this as the
      // primary freshness signal (see cmd_get_sync_mode / Settings copy).
      void invoke("cmd_sync_now").catch(() => {
        // sync failures are surfaced by later polls / rate-limit events
      });
    };

    const onFocus = () => run();
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", onFocus);
    };
  }, [rateLimitHit, onResume]);
}
