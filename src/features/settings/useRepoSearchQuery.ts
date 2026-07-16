import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface RepoSearchResult {
  fullName: string;
  description: string | null;
  stars: number;
  private: boolean;
}

interface UseRepoSearchQueryResult {
  results: RepoSearchResult[];
  loading: boolean;
  error: string | null;
}

// GitHub Search API は 30req/分 の制限があるためデバウンスする
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useRepoSearchQuery(query: string): UseRepoSearchQueryResult {
  const [results, setResults] = useState<RepoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const seq = ++seqRef.current;
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      invoke<RepoSearchResult[]>("cmd_search_repositories", { query: trimmed })
        .then((items) => {
          if (seqRef.current !== seq) return;
          setResults(items);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (seqRef.current !== seq) return;
          setError(String(e));
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
