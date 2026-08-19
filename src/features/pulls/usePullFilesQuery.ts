import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileDiffData } from "../../components/pulls/FileDiff";
import { getPrefetchPromise } from "../../lib/detailPrefetch";

export function usePullFilesQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
) {
  const [files, setFiles] = useState<FileDiffData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const run = useCallback(async () => {
    if (!owner || !repo || number === undefined) return;
    const requestId = ++requestIdRef.current;
    setFiles([]);
    setLoading(true);
    setError(null);
    try {
      const res = await (getPrefetchPromise<FileDiffData[]>("pull", owner, repo, number) ??
        invoke<FileDiffData[]>("cmd_get_pull_files", {
          owner,
          repo,
          number,
        }));
      if (requestId !== requestIdRef.current) return;
      setFiles(res);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(typeof e === "string" ? e : String(e));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [owner, repo, number]);

  useEffect(() => {
    void run();
  }, [run]);

  return { files, loading, error, refetch: run };
}
