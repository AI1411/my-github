import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, subtitle, actions }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6 gap-3"
      style={{ color: "var(--text-secondary)" }}
    >
      {icon && (
        <div
          className="w-12 h-12 flex items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="mt-2 flex gap-2">{actions}</div>}
    </div>
  );
}
