import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface TimelineEventSummary {
  id: number | null;
  event: string;
  createdAt: string;
  actorLogin: string | null;
  labelName: string | null;
  labelColor: string | null;
  assigneeLogin: string | null;
  milestoneTitle: string | null;
  crossRefTitle: string | null;
  crossRefNumber: number | null;
  crossRefUrl: string | null;
  body: string | null;
}

export interface UseIssueTimelineQueryResult {
  events: TimelineEventSummary[];
  loading: boolean;
  error: string | null;
}

export function useIssueTimelineQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
): UseIssueTimelineQueryResult {
  const [events, setEvents] = useState<TimelineEventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repo || !number) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<TimelineEventSummary[]>("cmd_list_issue_timeline", {
      owner,
      repo,
      number,
    })
      .then((e) => {
        if (!cancelled) setEvents(e);
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === "string" ? e : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  return { events, loading, error };
}
