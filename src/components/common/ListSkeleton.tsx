export interface ListSkeletonProps {
  rows?: number;
}

export function ListSkeleton({ rows = 8 }: ListSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex-1 overflow-hidden px-4 py-1"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div
            className="h-3 w-2/3 rounded animate-pulse"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          />
          <div
            className="h-2 w-1/3 rounded animate-pulse"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          />
        </div>
      ))}
    </div>
  );
}
