import type { IssueFilter } from "../../features/issues/issueFilter";

export interface AppliedFiltersProps {
  filter: IssueFilter;
  onChange: (next: IssueFilter) => void;
}

interface ChipProps {
  label: string;
  onClear: () => void;
}

function Chip({ label, onClear }: ChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
      style={{
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 leading-none"
        aria-label={`Clear ${label}`}
      >
        ×
      </button>
    </span>
  );
}

export function AppliedFilters({ filter, onChange }: AppliedFiltersProps) {
  const chips: { label: string; clear: () => void }[] = [];

  if (filter.state) {
    chips.push({
      label: `State: ${filter.state}`,
      clear: () => onChange({ ...filter, state: undefined }),
    });
  }
  for (const l of filter.labels) {
    chips.push({
      label: `Label: ${l}`,
      clear: () =>
        onChange({ ...filter, labels: filter.labels.filter((x) => x !== l) }),
    });
  }
  if (filter.repoFullName) {
    chips.push({
      label: `Repo: ${filter.repoFullName}`,
      clear: () => onChange({ ...filter, repoFullName: undefined }),
    });
  }
  if (filter.assigneeLogin) {
    chips.push({
      label: `Assignee: ${filter.assigneeLogin}`,
      clear: () => onChange({ ...filter, assigneeLogin: undefined }),
    });
  }
  if (filter.milestoneTitle) {
    chips.push({
      label: `Milestone: ${filter.milestoneTitle}`,
      clear: () => onChange({ ...filter, milestoneTitle: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Chip key={c.label} label={c.label} onClear={c.clear} />
      ))}
    </div>
  );
}
