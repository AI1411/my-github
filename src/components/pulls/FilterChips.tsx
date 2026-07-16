import type { PullFilter } from "../../features/pulls/usePullsQuery";

export interface FilterChipsProps {
  filter: PullFilter;
  onChange: (next: PullFilter) => void;
  availableRepos: string[];
  availableAuthors: string[];
  availableLabels: string[];
}

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onClear?: () => void;
}

function Chip({ label, active, onClick, onClear }: ChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
      style={{
        backgroundColor: active ? "var(--accent-blue)" : "var(--bg-tertiary)",
        color: active ? "#ffffff" : "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      {label}
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-1 leading-none"
          aria-label={`Clear ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function FilterChips({
  filter,
  onChange,
  availableRepos,
  availableAuthors,
  availableLabels,
}: FilterChipsProps) {
  const toggleState = () => {
    const next = filter.state === "open" ? "closed" : "open";
    onChange({ ...filter, state: next });
  };
  const selectRepo = () => {
    const idx = availableRepos.indexOf(filter.repoFullName ?? "");
    const next = availableRepos[(idx + 1) % availableRepos.length];
    onChange({ ...filter, repoFullName: next });
  };
  const selectAuthor = () => {
    const idx = availableAuthors.indexOf(filter.authorLogin ?? "");
    const next = availableAuthors[(idx + 1) % availableAuthors.length];
    onChange({ ...filter, authorLogin: next });
  };
  const toggleLabel = (label: string) => {
    const labels = filter.labels ?? [];
    const next = labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label];
    onChange({ ...filter, labels: next });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <Chip
        label={`State: ${filter.state ?? "any"}`}
        active={!!filter.state}
        onClick={toggleState}
        onClear={filter.state ? () => onChange({ ...filter, state: undefined }) : undefined}
      />
      {availableRepos.length > 0 && (
        <Chip
          label={`Repo: ${filter.repoFullName ?? "any"}`}
          active={!!filter.repoFullName}
          onClick={selectRepo}
          onClear={
            filter.repoFullName ? () => onChange({ ...filter, repoFullName: undefined }) : undefined
          }
        />
      )}
      {availableAuthors.length > 0 && (
        <Chip
          label={`Author: ${filter.authorLogin ?? "any"}`}
          active={!!filter.authorLogin}
          onClick={selectAuthor}
          onClear={
            filter.authorLogin ? () => onChange({ ...filter, authorLogin: undefined }) : undefined
          }
        />
      )}
      {availableLabels.map((l) => (
        <Chip
          key={l}
          label={l}
          active={(filter.labels ?? []).includes(l)}
          onClick={() => toggleLabel(l)}
        />
      ))}
    </div>
  );
}
