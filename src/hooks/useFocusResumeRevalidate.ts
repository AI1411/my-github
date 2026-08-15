import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../stores/uiStore";

const MIN_RESUME_GAP_MS = 5_000;

/**
 * On focus/visibility resume, kick a background sync unless rate-limited.
 * UI keeps showing cached data; sync updates stores asynchronously.
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
