import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  /** Optional prefix for panel ids referenced by aria-controls. */
  panelIdPrefix?: string;
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  className = "",
  panelIdPrefix,
}: TabsProps<T>) {
  const baseId = useId().replace(/:/g, "");
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  const panelId = (id: T) => `${panelIdPrefix ?? baseId}-panel-${id}`;
  const tabId = (id: T) => `${baseId}-tab-${id}`;

  const focusTab = (id: T) => {
    tabRefs.current.get(id)?.focus();
  };

  const moveFocus = (delta: number) => {
    const index = items.findIndex((item) => item.id === activeId);
    if (index < 0) return;
    const next = (index + delta + items.length) % items.length;
    const target = items[next];
    if (!target) return;
    onChange(target.id);
    focusTab(target.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = items[0];
      if (first) {
        onChange(first.id);
        focusTab(first.id);
      }
    } else if (event.key === "End") {
      event.preventDefault();
      const last = items[items.length - 1];
      if (last) {
        onChange(last.id);
        focusTab(last.id);
      }
    }
  };

  return (
    <div
      role="tablist"
      className={"flex gap-0 border-b " + className}
      style={{ borderColor: "var(--border-default)" }}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) tabRefs.current.set(item.id, el);
              else tabRefs.current.delete(item.id);
            }}
            id={tabId(item.id)}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={panelId(item.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
            }}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
