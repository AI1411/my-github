import { Avatar } from "../common/Avatar";
import { LabelPill } from "../common/LabelPill";
import type { ReviewerInfo } from "../../stores/dataStore";

export interface PrSidebarLabel {
  name: string;
  color: string;
}

export interface LinkedIssue {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: "open" | "closed";
}

export interface CheckSummary {
  name: string;
  conclusion: "success" | "failure" | "pending" | "neutral" | "skipped";
  htmlUrl?: string;
}

export interface PrSidebarProps {
  reviewers: ReviewerInfo[];
  assignees: ReviewerInfo[];
  labels: PrSidebarLabel[];
  milestone: string | null;
  linkedIssues: LinkedIssue[];
  checks: CheckSummary[];
  onAddReviewer?: () => void;
  onRemoveReviewer?: (login: string) => void;
}

function Section({
  title,
  children,
  empty,
  action,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <section className="px-3 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </h3>
        {action}
      </div>
      {empty ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          None
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function PeopleList({
  people,
  onRemove,
}: {
  people: ReviewerInfo[];
  onRemove?: (login: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {people.map((p) => (
        <li key={p.login} className="flex items-center gap-2 group">
          <Avatar login={p.login} src={p.avatarUrl} size="sm" />
          <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
            {p.login}
          </span>
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove reviewer ${p.login}`}
              className="text-xs opacity-0 group-hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
              onClick={() => onRemove(p.login)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const CHECK_COLOR: Record<CheckSummary["conclusion"], string> = {
  success: "var(--accent-green)",
  failure: "var(--accent-red)",
  pending: "var(--accent-yellow)",
  neutral: "var(--text-muted)",
  skipped: "var(--text-muted)",
};

export function PrSidebar({
  reviewers,
  assignees,
  labels,
  milestone,
  linkedIssues,
  checks,
  onAddReviewer,
  onRemoveReviewer,
}: PrSidebarProps) {
  return (
    <aside
      className="flex flex-col border-l overflow-y-auto"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
        width: 280,
      }}
    >
      <Section
        title="Reviewers"
        empty={reviewers.length === 0}
        action={
          onAddReviewer ? (
            <button
              type="button"
              className="text-[11px]"
              style={{ color: "var(--accent-blue)" }}
              onClick={onAddReviewer}
            >
              Add
            </button>
          ) : null
        }
      >
        <PeopleList people={reviewers} onRemove={onRemoveReviewer} />
      </Section>
      <Section title="Assignees" empty={assignees.length === 0}>
        <PeopleList people={assignees} />
      </Section>
      <Section title="Labels" empty={labels.length === 0}>
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <LabelPill key={l.name} name={l.name} color={l.color} />
          ))}
        </div>
      </Section>
      <Section title="Milestone" empty={!milestone}>
        <p className="text-xs" style={{ color: "var(--text-primary)" }}>
          {milestone}
        </p>
      </Section>
      <Section title="Linked issues" empty={linkedIssues.length === 0}>
        <ul className="flex flex-col gap-1">
          {linkedIssues.map((i) => (
            <li
              key={`${i.owner}/${i.repo}#${i.number}`}
              className="text-xs truncate"
              style={{ color: "var(--text-secondary)" }}
              title={i.title}
            >
              #{i.number} {i.title}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Checks" empty={checks.length === 0}>
        <ul className="flex flex-col gap-1.5">
          {checks.map((c) => (
            <li key={c.name} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: CHECK_COLOR[c.conclusion] }}
                aria-hidden
              />
              <span className="truncate" style={{ color: "var(--text-secondary)" }} title={c.name}>
                {c.name}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}
