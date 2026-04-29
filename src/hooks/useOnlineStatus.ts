import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../stores/uiStore";

export function useOnlineStatus() {
  const setOffline = useUiStore((state) => state.setOffline);

  useEffect(() => {
    let cancelled = false;

    const refreshOnlineStatus = async () => {
      if (!window.navigator.onLine) {
        setOffline(true);
        return;
      }
      try {
        const reachable = await invoke<boolean>("cmd_ping");
        if (!cancelled) setOffline(!reachable);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };

    void refreshOnlineStatus();
    window.addEventListener("online", refreshOnlineStatus);
    window.addEventListener("offline", refreshOnlineStatus);

    return () => {
      cancelled = true;
      window.removeEventListener("online", refreshOnlineStatus);
      window.removeEventListener("offline", refreshOnlineStatus);
    };
  }, [setOffline]);
}
