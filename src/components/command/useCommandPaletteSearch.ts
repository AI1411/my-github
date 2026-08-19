import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { shouldRunGithubSearch } from "../../lib/advancedSearch";
import type { CommandItem } from "./commandPaletteTypes";

type SearchResult = {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  repo: string;
  kind: string;
};

export function useCommandPaletteSearch(query: string, searchMode: boolean, advanced: boolean) {
  const [remoteResults, setRemoteResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    if (!shouldRunGithubSearch(query, searchMode)) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const trimmed = query.trim();
      invoke<SearchResult[]>("cmd_search_github", { query: trimmed })
        .then((results) => {
          if (searchSeqRef.current !== seq) return;
          const limit = advanced ? 10 : 5;
          setRemoteResults(
            results.slice(0, limit).map((r) => ({
              id: `gh-${r.id}`,
              label: r.title,
              subtitle: `#${r.number} · ${r.repo} · GitHub`,
              kind: "search" as const,
              href:
                r.kind === "pull"
                  ? `/pulls/${r.repo}/${r.number}`
                  : `/issues/${r.repo}/${r.number}`,
            })),
          );
        })
        .catch(() => {
          if (searchSeqRef.current !== seq) return;
          setRemoteResults([]);
        })
        .finally(() => {
          if (searchSeqRef.current !== seq) return;
          setSearching(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchMode, advanced]);

  return { remoteResults, searching };
}
