import type { CSSProperties } from "react";

export type CiBannerVariant = "failure" | "pending" | "success" | "neutral";

export interface CiBannerProps {
  variant: CiBannerVariant;
  summary: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const STYLE: Record<
  CiBannerVariant,
  { icon: string; bg: string; border: string; color: string }
> = {
  failure: {
    icon: "✗",
    bg: "rgba(232, 83, 83, 0.12)",
    border: "var(--accent-red)",
    color: "var(--accent-red)",
  },
  pending: {
    icon: "●",
    bg: "rgba(242, 199, 85, 0.12)",
    border: "var(--accent-yellow)",
    color: "var(--accent-yellow)",
  },
  success: {
    icon: "✓",
    bg: "rgba(87, 188, 116, 0.12)",
    border: "var(--accent-green)",
    color: "var(--accent-green)",
  },
  neutral: {
    icon: "?",
    bg: "var(--bg-tertiary)",
    border: "var(--border-subtle)",
    color: "var(--text-secondary)",
  },
};

export function CiBanner({
  variant,
  summary,
  description,
  actionLabel,
  onAction,
}: CiBannerProps) {
  const s = STYLE[variant];
  const rootStyle: CSSProperties = {
    backgroundColor: s.bg,
    borderColor: s.border,
    color: s.color,
  };
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border px-4 py-3 mx-4 my-3"
      style={rootStyle}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full font-bold"
        style={{
          width: 24,
          height: 24,
          color: s.color,
          border: `1px solid ${s.color}`,
        }}
      >
        {s.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{summary}</div>
        {description && (
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </div>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs px-2 py-1 rounded"
          style={{
            border: `1px solid ${s.color}`,
            color: s.color,
            backgroundColor: "transparent",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
