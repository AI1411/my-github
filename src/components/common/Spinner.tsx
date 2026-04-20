export interface SpinnerProps {
  className?: string;
  color?: string;
}

export function Spinner({
  className = "",
  color = "var(--accent-blue)",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={"inline-block w-3 h-3 rounded-full animate-pulse " + className}
      style={{ backgroundColor: color }}
    />
  );
}

export function SpinnerLarge({
  className = "",
  color = "var(--accent-blue)",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={"inline-block w-6 h-6 rounded-full animate-pulse " + className}
      style={{ backgroundColor: color }}
    />
  );
}
