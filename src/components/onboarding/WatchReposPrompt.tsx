import { useMemo, useState } from "react";
import { useRepoSearchQuery } from "../../features/settings/useRepoSearchQuery";
import {
  WatchRepoBulkChecklist,
  WatchRepoSourceTabs,
  type WatchRepoSource,
} from "../../features/settings/WatchRepoBulkChecklist";
import { useSettingsStore } from "../../stores/settingsStore";

export function WatchReposPrompt() {
  const watchedRepositories = useSettingsStore((state) => state.watchedRepositories);
  const dismissed = useSettingsStore((state) => state.watchOnboardingDismissed);
  const addWatchedRepositories = useSettingsStore((state) => state.addWatchedRepositories);
  const setWatchOnboardingDismissed = useSettingsStore(
    (state) => state.setWatchOnboardingDismissed,
  );
  const [source, setSource] = useState<WatchRepoSource>("search");
  const [query, setQuery] = useState("");
  const { results, loading, error } = useRepoSearchQuery(source === "search" ? query : "");
  const candidates = useMemo(
    () => results.filter((result) => !watchedRepositories.includes(result.fullName)),
    [results, watchedRepositories],
  );

  if (dismissed || watchedRepositories.length > 0) return null;

  function addRepos(fullNames: string[]) {
    addWatchedRepositories(fullNames);
    setQuery("");
  }

  function addRepo(fullName: string) {
    addRepos([fullName]);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-repos-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="w-full max-w-lg rounded-xl p-5 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h2
          id="watch-repos-title"
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Watch repositories
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Choose at least one repository to follow across Inbox, or skip and add them later in
          Settings.
        </p>
        <WatchRepoSourceTabs active={source} onChange={setSource} className="mt-4" />
        {source === "search" && (
          <>
            <form
              className="mt-1"
              onSubmit={(event) => {
                event.preventDefault();
                addRepo(query);
              }}
            >
              <input
                aria-label="Search repositories"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search owner/repository"
                autoComplete="off"
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </form>
            <ul
              className="mt-3 max-h-56 overflow-y-auto rounded-md"
              style={{ border: "1px solid var(--border-default)" }}
            >
              {loading && (
                <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  Searching…
                </li>
              )}
              {!loading && error && (
                <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  Search failed
                </li>
              )}
              {!loading && !error && query.trim().length >= 2 && candidates.length === 0 && (
                <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  No matching repositories
                </li>
              )}
              {!loading &&
                candidates.map((candidate) => (
                  <li key={candidate.fullName}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                      style={{ color: "var(--text-primary)" }}
                      onClick={() => addRepo(candidate.fullName)}
                    >
                      <span className="truncate">{candidate.fullName}</span>
                      <span style={{ color: "var(--text-muted)" }}>Watch</span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
        {source === "starred" && (
          <WatchRepoBulkChecklist
            mode="starred"
            watchedRepositories={watchedRepositories}
            onAddSelected={addRepos}
          />
        )}
        {source === "org" && (
          <WatchRepoBulkChecklist
            mode="org"
            watchedRepositories={watchedRepositories}
            onAddSelected={addRepos}
          />
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
            }}
            onClick={() => setWatchOnboardingDismissed(true)}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
