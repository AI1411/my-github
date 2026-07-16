export interface PrStats {
  files: number | null;
  additions: number | null;
  deletions: number | null;
  commits: number | null;
}

export interface PrSummaryCardProps {
  author?: string | null;
  description: string | null;
  stats: PrStats;
  createdAt?: string | null;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export function PrSummaryCard({ author, description, stats, createdAt }: PrSummaryCardProps) {
  return (
    <section
      className="mx-4 my-3 rounded-md border"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <header
        className="px-4 py-2 text-xs border-b"
        style={{
          color: "var(--text-muted)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {author ? <strong>{author}</strong> : "Unknown"}
        {createdAt && <> opened this pull request · {createdAt}</>}
      </header>
      <div
        className="px-4 py-3 text-sm whitespace-pre-wrap"
        style={{ color: "var(--text-primary)" }}
      >
        {description?.trim() || (
          <em style={{ color: "var(--text-muted)" }}>No description provided.</em>
        )}
      </div>
      <div
        className="flex gap-6 px-4 py-2 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <Stat label="Files" value={stats.files ?? "—"} />
        <Stat label="Additions" value={stats.additions !== null ? `+${stats.additions}` : "—"} />
        <Stat label="Deletions" value={stats.deletions !== null ? `-${stats.deletions}` : "—"} />
        <Stat label="Commits" value={stats.commits ?? "—"} />
      </div>
    </section>
  );
}
