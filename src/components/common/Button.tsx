import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  shortcut?: string;
  children: ReactNode;
  type?: "button" | "submit" | "reset";
}

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: "var(--accent-blue)",
    color: "#ffffff",
    border: "1px solid var(--accent-blue)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-default)",
  },
  danger: {
    backgroundColor: "var(--accent-red)",
    color: "#ffffff",
    border: "1px solid var(--accent-red)",
  },
};

export function Button({
  variant = "primary",
  shortcut,
  children,
  type = "button",
  style,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
      style={{ ...VARIANT_STYLE[variant], ...style }}
      {...rest}
    >
      <span>{children}</span>
      {shortcut && (
        <kbd
          className="text-[11px] px-1.5 py-0.5 rounded font-mono"
          style={{
            backgroundColor: "rgba(255,255,255,0.12)",
            color: "inherit",
          }}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
