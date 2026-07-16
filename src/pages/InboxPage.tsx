import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { InboxList } from "../components/inbox/InboxList";
import { InboxDetailPanel } from "../components/inbox/InboxDetailPanel";
import { useInboxQuery } from "../features/inbox/useInboxQuery";
import { snoozeUntilEpochSecs, type SnoozeOption } from "../lib/snooze";
import { findStaleItems } from "../lib/stalePulls";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { InboxItem } from "../stores/dataStore";

export default function InboxPage() {
  const { data, loading, error, refetch } = useInboxQuery();
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const pulls = useDataStore((state) => state.pulls);
  const currentUser = useAuthStore((state) => state.user?.login ?? null);
  const staleThresholds = useSettingsStore((state) => state.staleThresholds);

  const staleItems = useMemo(
    () =>
      findStaleItems({
        inbox: data,
        pulls,
        currentUser,
        thresholds: staleThresholds,
        now: new Date(),
      }),
    [data, pulls, currentUser, staleThresholds],
  );

  async function handleTogglePin(item: InboxItem) {
    try {
      await invoke("cmd_pin_inbox_item", {
        itemId: item.id,
        pinned: !item.pinned,
      });
      refetch();
    } catch {
      // 失敗時は次回の同期で状態が復元されるため黙って無視する
    }
  }

  async function handleSnooze(item: InboxItem, option: SnoozeOption) {
    try {
      await invoke("cmd_snooze_inbox_item", {
        itemId: item.id,
        snoozedUntil: snoozeUntilEpochSecs(option, new Date()),
      });
      if (selected?.id === item.id) setSelected(null);
      refetch();
    } catch {
      // 失敗時は項目が残るだけなので黙って無視する
    }
  }

  return (
    <div className="h-full flex flex-col">
      <Toolbar title="Inbox" subtitle="Review requests · CI failures · Mentions" />
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <EmptyState title="Failed to load inbox" subtitle={error} />}
      {data && (
        <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div
            className="overflow-y-auto border-r"
            style={{ borderColor: "var(--border-default)" }}
          >
            <InboxList
              data={data}
              staleItems={staleItems}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onTogglePin={handleTogglePin}
              onSnooze={handleSnooze}
            />
          </div>
          <div className="overflow-y-auto">
            <InboxDetailPanel item={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
