import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { sendReleaseNotification } from "../../lib/notifications";
import {
  findNewReleases,
  hasSeenReleases,
  loadSeenReleaseIds,
  saveSeenReleaseIds,
} from "../../lib/releases";
import { useDataStore, type ReleaseSummary } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";

export interface ReleasesQueryState {
  releases: ReleaseSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * watch対象リポジトリのリリースを取得してdataStoreへ反映する。
 * 初回取得は既知IDのシードのみ行い、以降の新規リリースをOS通知する。
 */
export function useReleasesQuery(): ReleasesQueryState {
  const releases = useDataStore((state) => state.releases);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await invoke<ReleaseSummary[]>("cmd_list_releases")) ?? [];
      useDataStore.getState().setReleases(result);

      const firstRun = !hasSeenReleases();
      const seen = loadSeenReleaseIds();
      const fresh = findNewReleases(result, seen);
      for (const release of fresh) seen.add(release.id);
      saveSeenReleaseIds(seen);

      const settings = useSettingsStore.getState();
      if (
        !firstRun &&
        settings.notificationSettings.enabled &&
        settings.releaseNotificationsEnabled
      ) {
        for (const release of fresh) {
          try {
            await sendReleaseNotification(release);
          } catch {
            // 通知失敗は無視（Activity上には表示される）
          }
        }
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReleases();
  }, [fetchReleases]);

  return { releases, loading, error, refetch: () => void fetchReleases() };
}
