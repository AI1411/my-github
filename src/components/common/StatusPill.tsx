export type Status = "open" | "merged" | "closed" | "draft";

const STATUS_STYLE: Record<Status, { label: string; bg: string; fg: string }> = {
  open: { label: "Open", bg: "var(--accent-green)", fg: "#ffffff" },
  merged: { label: "Merged", bg: "var(--accent-purple)", fg: "#1b1130" },
  closed: { label: "Closed", bg: "var(--accent-red)", fg: "#ffffff" },
  draft: {
    label: "Draft",
    bg: "var(--bg-overlay)",
    fg: "var(--text-secondary)",
  },
};

export interface StatusPillProps {
  status: Status;
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide " +
        className
      }
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
