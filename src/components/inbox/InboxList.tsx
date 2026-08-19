import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { InboxData, InboxItem } from "../../stores/dataStore";
import type { SnoozeOption } from "../../lib/snooze";
import { listRowHeight } from "../../lib/appearance";
import { useSettingsStore } from "../../stores/settingsStore";
import { InboxItemRow } from "./InboxItem";
import { EmptyState } from "../common/EmptyState";

interface InboxListProps {
  data: InboxData | null;
  staleItems?: InboxItem[];
  selectedId: string | null;
  onSelect: (item: InboxItem) => void;
  onTogglePin?: (item: InboxItem) => void;
  onSnooze?: (item: InboxItem, option: SnoozeOption) => void;
  registerItemRef?: (id: string) => (el: HTMLElement | null) => void;
}

const SECTION_HEADER_HEIGHT = 28;

type VirtualRow =
  | { kind: "header"; id: string; title: string; tone: "default" | "warning" }
  | { kind: "item"; id: string; item: InboxItem };

function buildVirtualRows(
  data: InboxData,
  staleItems: InboxItem[],
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  const sections: { title: string; items: InboxItem[]; tone?: "default" | "warning" }[] = [
    { title: "Stale", items: staleItems, tone: "warning" },
    { title: "Review Requests", items: data.reviewRequests },
    { title: "CI Failures", items: data.ciFailures },
    { title: "Mentions", items: data.mentions },
  ];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    rows.push({
      kind: "header",
      id: `header-${section.title}`,
      title: section.title,
      tone: section.tone ?? "default",
    });
    for (const item of section.items) {
      rows.push({ kind: "item", id: item.id, item });
    }
  }
  return rows;
}

export function InboxList({
  data,
  staleItems = [],
  selectedId,
  onSelect,
  onTogglePin,
  onSnooze,
  registerItemRef,
}: InboxListProps) {
  const density = useSettingsStore((s) => s.density);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = listRowHeight(density);

  const virtualRows = useMemo(
    () => (data ? buildVirtualRows(data, staleItems) : []),
    [data, staleItems],
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) =>
      virtualRows[index]?.kind === "header" ? SECTION_HEADER_HEIGHT : rowHeight,
    overscan: 8,
  });

  if (!data) return null;

  const isEmpty =
    staleItems.length === 0 &&
    data.reviewRequests.length === 0 &&
    data.ciFailures.length === 0 &&
    data.mentions.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={
          <span aria-hidden style={{ fontSize: 22 }}>
            ✓
          </span>
        }
        title="Inbox zero"
        subtitle="No review requests, CI failures, or mentions. You're all caught up."
      />
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto" role="grid">
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((v) => {
          const row = virtualRows[v.index];
          if (!row) return null;
          if (row.kind === "header") {
            return (
              <div
                key={row.id}
                className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: v.size,
                  transform: `translateY(${v.start}px)`,
                  color:
                    row.tone === "warning"
                      ? "var(--accent-orange, #fb923c)"
                      : "var(--text-muted)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                {row.title}
              </div>
            );
          }
          return (
            <div
              key={row.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: v.size,
                transform: `translateY(${v.start}px)`,
              }}
            >
              <InboxItemRow
                item={row.item}
                selected={selectedId === row.item.id}
                onSelect={() => onSelect(row.item)}
                onTogglePin={onTogglePin}
                onSnooze={onSnooze}
                rowRef={registerItemRef?.(row.item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
