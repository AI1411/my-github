import type { ReactNode } from "react";

export interface ToolbarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function Toolbar({ title, subtitle, actions }: ToolbarProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <div>
        <h1
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
