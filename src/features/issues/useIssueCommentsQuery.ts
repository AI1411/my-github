import { useEffect, useRef, useState } from "react";
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
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!owner || !repo || !number) {
      setComments([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setComments([]);
    setLoading(true);
    setError(null);
    invoke<IssueCommentSummary[]>("cmd_list_issue_comments", {
      owner,
      repo,
      number,
    })
      .then((c) => {
        if (requestId !== requestIdRef.current) return;
        setComments(c);
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

  return { comments, loading, error };
}
