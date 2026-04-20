import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileDiffData } from "../../components/pulls/FileDiff";

export function usePullFilesQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
) {
  const [files, setFiles] = useState<FileDiffData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!owner || !repo || number === undefined) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<FileDiffData[]>("cmd_get_pull_files", {
        owner,
        repo,
        number,
      });
      setFiles(res);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setLoading(false);
    }
  }, [owner, repo, number]);

  useEffect(() => {
    void run();
  }, [run]);

  return { files, loading, error, refetch: run };
}
