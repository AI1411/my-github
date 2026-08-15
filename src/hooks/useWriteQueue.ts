import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  clearWriteQueue,
  discardWrite,
  flushWriteQueue,
  loadWriteQueue,
  subscribeWriteQueue,
  type WriteQueueEntry,
} from "../lib/writeQueue";

function subscribe(onStoreChange: () => void): () => void {
  return subscribeWriteQueue(() => onStoreChange());
}

function getSnapshot(): WriteQueueEntry[] {
  return loadWriteQueue();
}

function getServerSnapshot(): WriteQueueEntry[] {
  return [];
}

/**
 * Subscribes to the offline write queue, flushes on online/focus,
 * and exposes retry / discard helpers for the pending-writes banner.
 */
export function useWriteQueue() {
  const queue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    flushingRef.current = true;
    setFlushing(true);
    try {
      await flushWriteQueue({
        invoke: (command, args) => invoke(command, args),
      });
    } finally {
      flushingRef.current = false;
      setFlushing(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      void flush();
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void flush();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // Attempt a flush on mount in case the app resumed with a pending queue.
    void flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [flush]);

  const discard = useCallback((id: string) => {
    discardWrite(id);
  }, []);

  const discardAll = useCallback(() => {
    clearWriteQueue();
  }, []);

  return {
    queue,
    pendingCount: queue.length,
    flushing,
    retry: flush,
    discard,
    discardAll,
  };
}
