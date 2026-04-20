import type { ReactNode } from "react";

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
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={"flex gap-0 border-b " + className}
      style={{ borderColor: "var(--border-default)" }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
            style={{
              color: active
                ? "var(--text-primary)"
                : "var(--text-secondary)",
              borderBottom: active
                ? "2px solid var(--accent-blue)"
                : "2px solid transparent",
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
