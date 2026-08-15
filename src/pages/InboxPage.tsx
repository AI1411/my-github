import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { InboxList } from "../components/inbox/InboxList";
import { InboxDetailPanel } from "../components/inbox/InboxDetailPanel";
import { SnoozePicker } from "../components/inbox/SnoozePicker";
import { useInboxQuery } from "../features/inbox/useInboxQuery";
import { useSettingsShortcut } from "../hooks/useSettingsShortcut";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { useListNavigation } from "../hooks/useListNavigation";
import { focusAfterRemoval } from "../lib/inboxFocus";
import { CHORD_TIMEOUT_MS } from "../lib/shortcutKeys";
import {
  loadLastSnoozeOption,
  saveLastSnoozeOption,
  snoozeUntilEpochSecs,
  SNOOZE_OPTIONS,
  type SnoozeOption,
} from "../lib/snooze";
import { findStaleItems } from "../lib/stalePulls";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { InboxItem } from "../stores/dataStore";

function flattenInboxItems(
  data: { reviewRequests: InboxItem[]; ciFailures: InboxItem[]; mentions: InboxItem[] },
  staleItems: InboxItem[],
): InboxItem[] {
  return [...staleItems, ...data.reviewRequests, ...data.ciFailures, ...data.mentions];
}

/** Stale 表示用 ID から実体の Inbox 項目へ解決する。snooze 不能なら null。 */
export function resolveSnoozeTarget(
  item: InboxItem | null,
  allItems: InboxItem[],
): InboxItem | null {
  if (!item) return null;
  if (!item.id.startsWith("stale-")) return item;
  if (item.id.startsWith("stale-own-")) return null;
  const originalId = item.id.slice("stale-".length);
  return allItems.find((candidate) => candidate.id === originalId) ?? null;
}

export default function InboxPage() {
  const { data, loading, error, refetch } = useInboxQuery();
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const flatItems = useMemo(
    () => (data ? flattenInboxItems(data, staleItems) : []),
    [data, staleItems],
  );

  const getId = useCallback((item: InboxItem) => item.id, []);

  const { activeId, activeItem, setActiveId, registerItemRef } = useListNavigation({
    items: flatItems,
    getId,
    onSelect: setSelected,
    onOpen: setSelected,
    enabled: flatItems.length > 0 && !pickerOpen,
  });

  useEffect(() => {
    if (activeItem && selected?.id !== activeItem.id) {
      setSelected(activeItem);
    }
  }, [activeItem, selected?.id]);

  async function handleTogglePin(item: InboxItem) {
    const target =
      resolveSnoozeTarget(item, flatItems) ?? (item.id.startsWith("stale-") ? null : item);
    if (!target) return;
    try {
      await invoke("cmd_pin_inbox_item", {
        itemId: target.id,
        pinned: !target.pinned,
      });
      refetch();
    } catch {
      // 失敗時は次回の同期で状態が復元されるため黙って無視する
    }
  }

  async function handleSnooze(item: InboxItem, option: SnoozeOption) {
    const target =
      resolveSnoozeTarget(item, flatItems) ?? (item.id.startsWith("stale-") ? null : item);
    if (!target) return;
    try {
      await invoke("cmd_snooze_inbox_item", {
        itemId: target.id,
        snoozedUntil: snoozeUntilEpochSecs(option, new Date()),
      });
      saveLastSnoozeOption(option);
      setPickerOpen(false);
      if (selected?.id === item.id || selected?.id === target.id) setSelected(null);
      refetch();
    } catch {
      // 失敗時は項目が残るだけなので黙って無視する
    }
  }

  function targetForSnooze(): InboxItem | null {
    return resolveSnoozeTarget(activeItem ?? selected, flatItems);
  }

  async function handleDismiss(item: InboxItem) {
    const target = resolveSnoozeTarget(item, flatItems);
    if (!target) return;
    const idsBefore = flatItems.map((entry) => entry.id);
    const nextId = focusAfterRemoval(idsBefore, item.id);
    try {
      await invoke("cmd_dismiss_inbox_item", { itemId: target.id });
      setPickerOpen(false);
      if (nextId) {
        setActiveId(nextId);
        setSelected(flatItems.find((entry) => entry.id === nextId) ?? null);
      } else {
        setSelected(null);
      }
      refetch();
    } catch {
      // 失敗時は項目が残るだけなので黙って無視する
    }
  }

  async function handleDismissAll() {
    const targets = new Set<string>();
    for (const item of flatItems) {
      const resolved = resolveSnoozeTarget(item, flatItems);
      if (resolved) targets.add(resolved.id);
    }
    if (targets.size === 0) return;
    try {
      await invoke("cmd_dismiss_inbox_items", { itemIds: [...targets] });
      setPickerOpen(false);
      setSelected(null);
      refetch();
    } catch {
      // 失敗時は項目が残るだけなので黙って無視する
    }
  }

  useSettingsShortcut("snooze", () => {
    if (!targetForSnooze()) return;
    setPickerOpen(true);
  });

  useSettingsShortcut("snoozeLast", () => {
    const target = targetForSnooze();
    if (!target) return;
    const last = loadLastSnoozeOption();
    if (last) {
      void handleSnooze(target, last);
    } else {
      setPickerOpen(true);
    }
  });

  useSettingsShortcut("markRead", () => {
    const current = activeItem ?? selected;
    if (!current) return;
    void handleDismiss(current);
  });

  useSettingsShortcut("markAllRead", () => {
    void handleDismissAll();
  });

  const lastGAtRef = useRef(0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "g" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        lastGAtRef.current = Date.now();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useKeyboardShortcut({ key: "p", preventDefault: true }, () => {
    if (pickerOpen) return;
    if (Date.now() - lastGAtRef.current < CHORD_TIMEOUT_MS) return;
    const current = activeItem ?? selected;
    if (!current) return;
    void handleTogglePin(current);
  });

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index < 0 || index >= SNOOZE_OPTIONS.length) return;
      const target = targetForSnooze();
      if (!target) return;
      event.preventDefault();
      void handleSnooze(target, SNOOZE_OPTIONS[index].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, activeItem, selected]);

  useKeyboardShortcut(
    { key: "Escape", preventDefault: true },
    () => {
      if (pickerOpen) setPickerOpen(false);
    },
    {},
  );
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
              selectedId={activeId ?? selected?.id ?? null}
              onSelect={(item) => {
                setActiveId(item.id);
                setSelected(item);
              }}
              onTogglePin={handleTogglePin}
              onSnooze={handleSnooze}
              registerItemRef={registerItemRef}
            />
          </div>
          <div className="overflow-y-auto">
            <InboxDetailPanel item={selected} />
          </div>
        </div>
      )}
      <SnoozePicker
        open={pickerOpen}
        onPick={(option) => {
          const target = targetForSnooze();
          if (target) void handleSnooze(target, option);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
