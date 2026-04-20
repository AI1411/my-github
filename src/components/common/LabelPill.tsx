export interface LabelPillProps {
  name: string;
  color: string;
  className?: string;
}

function normalizeHex(hex: string): string {
  const raw = hex.replace(/^#/, "");
  if (raw.length === 3) {
    return raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return raw.padEnd(6, "0").slice(0, 6);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function LabelPill({ name, color, className = "" }: LabelPillProps) {
  const fg = `#${normalizeHex(color)}`;
  const bg = hexToRgba(color, 0.15);
  const border = hexToRgba(color, 0.4);
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium " +
        className
      }
      style={{
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: fg }}
        aria-hidden
      />
      {name}
    </span>
  );
}
