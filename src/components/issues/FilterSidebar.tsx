import type { ReactNode } from "react";
import {
  type IssueFilter,
  toggleLabel,
} from "../../features/issues/issueFilter";

export interface AvailableLabel {
  name: string;
  color: string;
  count: number;
}

export interface FilterSidebarProps {
  filter: IssueFilter;
  onChange: (next: IssueFilter) => void;
  availableLabels: AvailableLabel[];
  availableAssignees: string[];
  availableRepos: string[];
  availableMilestones: string[];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="px-3 py-3 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <h3
        className="text-[11px] uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function StateRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-left px-2 py-1 rounded"
      style={{
        backgroundColor: active ? "var(--bg-overlay)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}

export function FilterSidebar({
  filter,
  onChange,
  availableLabels,
  availableAssignees,
  availableRepos,
  availableMilestones,
}: FilterSidebarProps) {
  return (
    <div className="flex flex-col">
      <Section title="State">
        <StateRow
          label="Open"
          active={filter.state === "open"}
          onClick={() => onChange({ ...filter, state: "open" })}
        />
        <StateRow
          label="Closed"
          active={filter.state === "closed"}
          onClick={() => onChange({ ...filter, state: "closed" })}
        />
        <StateRow
          label="All"
          active={!filter.state}
          onClick={() => onChange({ ...filter, state: undefined })}
        />
      </Section>

      <Section title="Labels">
        {availableLabels.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            None
          </p>
        ) : (
          availableLabels.map((l) => {
            const checked = filter.labels.includes(l.name);
            return (
              <label
                key={l.name}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(toggleLabel(filter, l.name))}
                  aria-label={l.name}
                />
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: `#${l.color}` }}
                  aria-hidden
                />
                <span className="flex-1 truncate">{l.name}</span>
                <span style={{ color: "var(--text-muted)" }}>{l.count}</span>
              </label>
            );
          })
        )}
      </Section>

      <Section title="Assignee">
        {availableAssignees.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            None
          </p>
        ) : (
          availableAssignees.map((a) => (
            <StateRow
              key={a}
              label={a}
              active={filter.assigneeLogin === a}
              onClick={() =>
                onChange({
                  ...filter,
                  assigneeLogin: filter.assigneeLogin === a ? undefined : a,
                })
              }
            />
          ))
        )}
      </Section>

      <Section title="Repository">
        {availableRepos.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            None
          </p>
        ) : (
          availableRepos.map((r) => (
            <StateRow
              key={r}
              label={r}
              active={filter.repoFullName === r}
              onClick={() =>
                onChange({
                  ...filter,
                  repoFullName: filter.repoFullName === r ? undefined : r,
                })
              }
            />
          ))
        )}
      </Section>

      <Section title="Milestone">
        {availableMilestones.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            None
          </p>
        ) : (
          availableMilestones.map((m) => (
            <StateRow
              key={m}
              label={m}
              active={filter.milestoneTitle === m}
              onClick={() =>
                onChange({
                  ...filter,
                  milestoneTitle: filter.milestoneTitle === m ? undefined : m,
                })
              }
            />
          ))
        )}
      </Section>
    </div>
  );
}
