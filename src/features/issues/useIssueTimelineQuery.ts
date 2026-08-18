import { useEffect, useRef, useState } from "react";
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
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!owner || !repo || !number) {
      setEvents([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setEvents([]);
    setLoading(true);
    setError(null);
    invoke<TimelineEventSummary[]>("cmd_list_issue_timeline", {
      owner,
      repo,
      number,
    })
      .then((e) => {
        if (requestId !== requestIdRef.current) return;
        setEvents(e);
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setError(typeof e === "string" ? e : String(e));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [owner, repo, number]);

  return { events, loading, error };
}
