import { formatRelativeTime } from "../../lib/relativeTime";
import type { TimelineEventSummary } from "../../features/issues/useIssueTimelineQuery";

export interface IssueTimelineProps {
  events: TimelineEventSummary[];
}

const SEPARATOR_EVENTS = new Set([
  "labeled",
  "unlabeled",
  "assigned",
  "unassigned",
  "milestoned",
  "demilestoned",
  "cross-referenced",
  "closed",
  "reopened",
]);

function describeEvent(ev: TimelineEventSummary): string {
  const actor = ev.actorLogin ?? "someone";
  switch (ev.event) {
    case "labeled":
      return `${actor} added label ${ev.labelName ?? ""}`.trim();
    case "unlabeled":
      return `${actor} removed label ${ev.labelName ?? ""}`.trim();
    case "assigned":
      return `${actor} assigned ${ev.assigneeLogin ?? "someone"}`;
    case "unassigned":
      return `${actor} unassigned ${ev.assigneeLogin ?? "someone"}`;
    case "milestoned":
      return `${actor} added this to milestone ${ev.milestoneTitle ?? ""}`.trim();
    case "demilestoned":
      return `${actor} removed this from milestone ${ev.milestoneTitle ?? ""}`.trim();
    case "cross-referenced": {
      const ref =
        ev.crossRefNumber !== null && ev.crossRefNumber !== undefined
          ? `#${ev.crossRefNumber}${ev.crossRefTitle ? ` ${ev.crossRefTitle}` : ""}`
          : (ev.crossRefTitle ?? "another issue");
      return `${actor} mentioned this in ${ref}`;
    }
    case "closed":
      return `${actor} closed this`;
    case "reopened":
      return `${actor} reopened this`;
    default:
      return `${actor} ${ev.event}`;
  }
}

export function IssueTimeline({ events }: IssueTimelineProps) {
  const separators = events.filter((e) => SEPARATOR_EVENTS.has(e.event));
  if (separators.length === 0) return null;

  return (
    <ol className="mx-4 my-2 flex flex-col gap-1" aria-label="Issue timeline">
      {separators.map((ev, idx) => (
        <li
          key={`${ev.event}-${ev.id ?? idx}-${ev.createdAt}`}
          className="flex items-center gap-2 px-1 py-1 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--border-strong, var(--border-subtle))" }}
            aria-hidden
          />
          {ev.event === "cross-referenced" && ev.crossRefUrl ? (
            <a
              href={ev.crossRefUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: "var(--text-secondary)" }}
            >
              {describeEvent(ev)}
            </a>
          ) : (
            <span>{describeEvent(ev)}</span>
          )}
          {ev.labelName && (ev.event === "labeled" || ev.event === "unlabeled") && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: ev.labelColor ? `#${ev.labelColor}33` : "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {ev.labelName}
            </span>
          )}
          <span className="ml-auto shrink-0">{formatRelativeTime(ev.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}
