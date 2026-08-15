import type { ReactNode } from "react";
import { Avatar } from "../common/Avatar";
import { LabelPill } from "../common/LabelPill";
import type { IssueAssigneeInfo, IssueLabelInfo } from "../../stores/dataStore";

export interface IssueSidebarMilestone {
  title: string;
  openIssues: number;
  closedIssues: number;
}

export interface IssueSidebarLinkedPr {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
}

export interface IssueSidebarParticipant {
  login: string;
  avatarUrl: string;
}

export interface IssueSidebarProps {
  assignees: IssueAssigneeInfo[];
  labels: IssueLabelInfo[];
  milestone: IssueSidebarMilestone | null;
  linkedPrs: IssueSidebarLinkedPr[];
  participants: IssueSidebarParticipant[];
  subscribed: boolean;
  onAddLabel?: () => void;
  onRemoveLabel?: (name: string) => void;
  onAddAssignee?: () => void;
  onRemoveAssignee?: (login: string) => void;
}

function Section({
  title,
  children,
  empty,
  action,
}: {
  title: string;
  children: ReactNode;
  empty?: boolean;
  action?: ReactNode;
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
  people: IssueAssigneeInfo[];
  onRemove?: (login: string) => void;
}) {
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
              aria-label={`Remove assignee ${p.login}`}
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

function MilestoneCard({ m }: { m: IssueSidebarMilestone }) {
  const total = m.openIssues + m.closedIssues;
  const pct = total === 0 ? 0 : Math.round((m.closedIssues / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {m.title}
      </p>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
      >
        <div
          data-testid="milestone-progress-fill"
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--accent-green)",
          }}
        />
      </div>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {m.closedIssues} / {total} closed
      </p>
    </div>
  );
}

const PR_DOT: Record<IssueSidebarLinkedPr["state"], string> = {
  open: "var(--accent-green)",
  closed: "var(--accent-red)",
  merged: "var(--accent-purple)",
};

export function IssueSidebar({
  assignees,
  labels,
  milestone,
  linkedPrs,
  participants,
  subscribed,
  onAddLabel,
  onRemoveLabel,
  onAddAssignee,
  onRemoveAssignee,
}: IssueSidebarProps) {
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
        title="Assignees"
        empty={assignees.length === 0}
        action={
          onAddAssignee ? (
            <button
              type="button"
              className="text-[11px]"
              style={{ color: "var(--accent-blue)" }}
              onClick={onAddAssignee}
            >
              Add
            </button>
          ) : null
        }
      >
        <PeopleList people={assignees} onRemove={onRemoveAssignee} />
      </Section>
      <Section
        title="Labels"
        empty={labels.length === 0}
        action={
          onAddLabel ? (
            <button
              type="button"
              className="text-[11px]"
              style={{ color: "var(--accent-blue)" }}
              onClick={onAddLabel}
            >
              Add
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-1">
              <LabelPill name={l.name} color={l.color} />
              {onRemoveLabel && (
                <button
                  type="button"
                  aria-label={`Remove label ${l.name}`}
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => onRemoveLabel(l.name)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </Section>
      <Section title="Milestone" empty={!milestone}>
        {milestone && <MilestoneCard m={milestone} />}
      </Section>
      <Section title="Linked PRs" empty={linkedPrs.length === 0}>
        <ul className="flex flex-col gap-1">
          {linkedPrs.map((p) => (
            <li
              key={`${p.owner}/${p.repo}#${p.number}`}
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: PR_DOT[p.state] }}
                aria-hidden
              />
              <span className="truncate" title={p.title}>
                #{p.number} {p.title}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Participants" empty={participants.length === 0}>
        <div className="flex flex-wrap gap-1">
          {participants.map((p) => (
            <Avatar key={p.login} login={p.login} src={p.avatarUrl} size="xs" />
          ))}
        </div>
      </Section>
      <Section title="Notifications">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {subscribed ? "Subscribed" : "Not subscribed"}
        </p>
      </Section>
    </aside>
  );
}
