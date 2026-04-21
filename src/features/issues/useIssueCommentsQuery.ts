import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface IssueCommentSummary {
  id: number;
  author: { login: string; avatarUrl: string };
  body: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  authorAssociation: string | null;
}

export interface UseIssueCommentsQueryResult {
  comments: IssueCommentSummary[];
  loading: boolean;
  error: string | null;
}

export function useIssueCommentsQuery(
  owner: string | undefined,
  repo: string | undefined,
  number: number | undefined,
): UseIssueCommentsQueryResult {
  const [comments, setComments] = useState<IssueCommentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repo || !number) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<IssueCommentSummary[]>("cmd_list_issue_comments", {
      owner,
      repo,
      number,
    })
      .then((c) => {
        if (!cancelled) setComments(c);
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

  return { comments, loading, error };
}
