import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";
import { ListSkeleton } from "../components/common/ListSkeleton";
import { InboxList } from "../components/inbox/InboxList";
import { InboxDetailPanel } from "../components/inbox/InboxDetailPanel";
import { SnoozePicker } from "../components/inbox/SnoozePicker";
import { ListSearchBar } from "../components/common/ListSearchBar";
import { useInboxQuery } from "../features/inbox/useInboxQuery";
import { useSettingsShortcut } from "../hooks/useSettingsShortcut";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { useListNavigation } from "../hooks/useListNavigation";
import { useListSearch } from "../hooks/useListSearch";
import { useOpenInBrowserShortcut } from "../hooks/useOpenInBrowserShortcut";
import { matchesListSearch } from "../lib/listSearch";
import { focusAfterRemoval } from "../lib/inboxFocus";
import { buildInboxQueue, inboxItemDetailPath, saveInboxQueue } from "../lib/inboxQueue";
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
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useInboxQuery();
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pulls = useDataStore((state) => state.pulls);
  const currentUser = useAuthStore((state) => state.user?.login ?? null);
  const staleThresholds = useSettingsStore((state) => state.staleThresholds);
  const accountId = useAuthStore((state) => state.user?.login ?? "");
  const listSearch = useListSearch(accountId, "inbox");

  const reportActionError = (cause: unknown) => {
    setActionError(cause instanceof Error ? cause.message : String(cause));
  };

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

  const matchItem = useCallback(
    (item: InboxItem) =>
      matchesListSearch(`${item.title} ${item.repo} ${item.number ?? ""}`, listSearch.query),
    [listSearch.query],
  );

  const visibleData = useMemo(() => {
    if (!data) return null;
    return {
      reviewRequests: data.reviewRequests.filter(matchItem),
      ciFailures: data.ciFailures.filter(matchItem),
      mentions: data.mentions.filter(matchItem),
    };
  }, [data, matchItem]);

  const visibleStaleItems = useMemo(() => staleItems.filter(matchItem), [staleItems, matchItem]);

  const flatItems = useMemo(
    () => (visibleData ? flattenInboxItems(visibleData, visibleStaleItems) : []),
    [visibleData, visibleStaleItems],
  );

  const getId = useCallback((item: InboxItem) => item.id, []);

  const openFromInbox = useCallback(
    (item: InboxItem) => {
      const path = inboxItemDetailPath(item);
      if (!path) {
        setSelected(item);
        return;
      }
      saveInboxQueue(buildInboxQueue(flatItems), item.id);
      navigate(`${path}?from=inbox`);
    },
    [flatItems, navigate],
  );

  const { activeId, activeItem, setActiveId, registerItemRef } = useListNavigation({
    items: flatItems,
    getId,
    onSelect: setSelected,
    onOpen: openFromInbox,
    enabled: flatItems.length > 0 && !pickerOpen,
  });

  useOpenInBrowserShortcut((activeItem ?? selected)?.htmlUrl ?? null);

  async function handleTogglePin(item: InboxItem) {
    const target =
      resolveSnoozeTarget(item, flatItems) ?? (item.id.startsWith("stale-") ? null : item);
    if (!target) return;
    try {
      await invoke("cmd_pin_inbox_item", {
        itemId: target.id,
        pinned: !target.pinned,
      });
      setActionError(null);
      refetch();
    } catch (cause) {
      reportActionError(cause);
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
      setActionError(null);
      if (selected?.id === item.id || selected?.id === target.id) setSelected(null);
      refetch();
    } catch (cause) {
      reportActionError(cause);
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
      setActionError(null);
      if (nextId) {
        setActiveId(nextId);
        setSelected(flatItems.find((entry) => entry.id === nextId) ?? null);
      } else {
        setSelected(null);
      }
      refetch();
    } catch (cause) {
      reportActionError(cause);
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
      setActionError(null);
      setSelected(null);
      refetch();
    } catch (cause) {
      reportActionError(cause);
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
      if (document.querySelector('[role="dialog"][aria-label="Shortcut help"]')) return;
      if (listSearch.open) {
        listSearch.setQuery("");
        listSearch.setOpen(false);
        return;
      }
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      setSelected(null);
    },
    {},
  );
  return (
    <div className="h-full flex flex-col">
      <Toolbar title="Inbox" subtitle="Review requests · CI failures · Mentions" />
      <ListSearchBar
        open={listSearch.open}
        query={listSearch.query}
        onQueryChange={listSearch.setQuery}
        inputRef={listSearch.inputRef}
        placeholder="Filter inbox…"
      />
      {actionError && (
        <div
          role="alert"
          className="px-4 py-2 text-xs border-b"
          style={{
            color: "var(--accent-red)",
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in srgb, var(--accent-red) 8%, transparent)",
          }}
        >
          {actionError}
        </div>
      )}
      {loading && !data && <ListSkeleton />}
      {error && <EmptyState title="Failed to load inbox" subtitle={error} />}
      {data && (
        <div
          className="flex-1 grid overflow-hidden"
          style={{ gridTemplateColumns: selected ? "1fr 1fr" : "1fr" }}
        >
          <div
            className="min-h-0 border-r"
            style={{ borderColor: selected ? "var(--border-default)" : "transparent" }}
          >
            <InboxList
              data={visibleData}
              staleItems={visibleStaleItems}
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
          {selected && (
            <div className="overflow-y-auto">
              <InboxDetailPanel item={selected} onOpenInApp={openFromInbox} />
            </div>
          )}
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
