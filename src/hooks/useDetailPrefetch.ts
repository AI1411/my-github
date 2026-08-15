import { useEffect, useRef } from "react";
import { prefetchIssueDetail, prefetchPullDetail } from "../lib/detailPrefetch";

const DEBOUNCE_MS = 120;

export function useDetailPrefetch(
  kind: "pull" | "issue",
  active: { repo: string; number: number } | null,
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    const [owner, repo] = active.repo.split("/");
    if (!owner || !repo) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (kind === "pull") prefetchPullDetail(owner, repo, active.number);
      else prefetchIssueDetail(owner, repo, active.number);
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kind, active?.repo, active?.number]);
}
