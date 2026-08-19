import type { ReactNode } from "react";

export function sectionStyle() {
  return { borderColor: "var(--border-subtle)" };
}

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-b px-6 py-5" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="grid min-h-11 grid-cols-[220px_1fr] items-center gap-4 border-t py-2 first:border-t-0"
      style={sectionStyle()}
    >
      <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="min-w-0 text-sm" style={{ color: "var(--text-primary)" }}>
        {children ?? value}
      </div>
    </div>
  );
}

export function InlineButton({
  children,
  onClick,
  active = false,
  disabled = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
      style={{
        backgroundColor: active ? "var(--accent-blue)" : "var(--bg-tertiary)",
        border: "1px solid var(--border-default)",
        color: active ? "#ffffff" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
