import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tabs, type TabItem } from "../../components/common/Tabs";

export type WatchRepoSource = "search" | "starred" | "org";

const SOURCE_TABS: TabItem<WatchRepoSource>[] = [
  { id: "search", label: "Search" },
  { id: "starred", label: "Starred" },
  { id: "org", label: "Org" },
];

export interface WatchRepoSourceTabsProps {
  active: WatchRepoSource;
  onChange: (source: WatchRepoSource) => void;
  className?: string;
}

export function WatchRepoSourceTabs({ active, onChange, className }: WatchRepoSourceTabsProps) {
  return (
    <Tabs
      items={SOURCE_TABS}
      activeId={active}
      onChange={onChange}
      className={className ?? "mb-3"}
      panelIdPrefix="watch-repo-source"
    />
  );
}

export interface WatchRepoBulkChecklistProps {
  mode: "starred" | "org";
  watchedRepositories: string[];
  onAddSelected: (fullNames: string[]) => void;
}

export function WatchRepoBulkChecklist({
  mode,
  watchedRepositories,
  onAddSelected,
}: WatchRepoBulkChecklistProps) {
  const [orgs, setOrgs] = useState<string[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => repos.filter((repo) => !watchedRepositories.includes(repo)),
    [repos, watchedRepositories],
  );

  useEffect(() => {
    setSelected(new Set());
  }, [mode, selectedOrg, repos]);

  useEffect(() => {
    if (mode !== "starred") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<string[]>("cmd_list_starred_repos")
      .then((items) => {
        if (cancelled) return;
        setRepos(items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
        setRepos([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "org") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<string[]>("cmd_list_user_orgs")
      .then((items) => {
        if (cancelled) return;
        setOrgs(items);
        setSelectedOrg((current) => current || items[0] || "");
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
        setOrgs([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "org" || !selectedOrg) {
      if (mode === "org") setRepos([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<string[]>("cmd_list_org_repos", { org: selectedOrg })
      .then((items) => {
        if (cancelled) return;
        setRepos(items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
        setRepos([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedOrg]);

  function toggleRepo(fullName: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  function handleAddSelected() {
    const toAdd = candidates.filter((repo) => selected.has(repo));
    if (toAdd.length === 0) return;
    onAddSelected(toAdd);
    setSelected(new Set());
  }

  return (
    <div>
      {mode === "org" && (
        <label className="mb-3 block text-sm" style={{ color: "var(--text-secondary)" }}>
          Organization
          <select
            aria-label="Organization"
            value={selectedOrg}
            onChange={(event) => setSelectedOrg(event.currentTarget.value)}
            disabled={loading && orgs.length === 0}
            className="mt-1 block w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            {orgs.length === 0 ? (
              <option value="">No organizations</option>
            ) : (
              orgs.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))
            )}
          </select>
        </label>
      )}
      <ul
        className="max-h-56 overflow-y-auto rounded-md"
        style={{ border: "1px solid var(--border-default)" }}
        aria-label={mode === "starred" ? "Starred repositories" : "Organization repositories"}
      >
        {loading && (
          <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </li>
        )}
        {!loading && error && (
          <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Failed to load repositories
          </li>
        )}
        {!loading && !error && candidates.length === 0 && (
          <li className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {mode === "starred" ? "No starred repositories to add" : "No repositories to add"}
          </li>
        )}
        {!loading &&
          !error &&
          candidates.map((fullName) => (
            <li key={fullName}>
              <label
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(fullName)}
                  onChange={() => toggleRepo(fullName)}
                  aria-label={fullName}
                />
                <span className="truncate">{fullName}</span>
              </label>
            </li>
          ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={candidates.every((repo) => !selected.has(repo))}
          className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent-blue)",
            color: "white",
          }}
          onClick={handleAddSelected}
        >
          Add selected
        </button>
      </div>
    </div>
  );
}
