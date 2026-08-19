import { useCallback, useRef } from "react";

/** Monotonic request id guard for stale async query results. */
export function useSequencedRequest() {
  const requestIdRef = useRef(0);
  const nextRequestId = useCallback(() => ++requestIdRef.current, []);
  const isCurrentRequest = useCallback(
    (requestId: number) => requestId === requestIdRef.current,
    [],
  );
  return { nextRequestId, isCurrentRequest };
}
