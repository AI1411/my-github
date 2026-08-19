import { useMemo, useState } from "react";
import { EmptyState } from "../components/common/EmptyState";
import { Toolbar } from "../components/common/Toolbar";
import {
  collectDashboardOrgs,
  collectDashboardRepos,
  reposForOrg,
  summarizeUnitDashboard,
} from "../lib/unitDashboard";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";

type ScopeMode = "repo" | "org";

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "default";
}) {
  const color =
    tone === "danger" && value > 0 ? "var(--accent-red)" : "var(--text-primary)";
  return (
    <div
      className="rounded-md px-4 py-3 flex flex-col gap-1"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border-default)",
      }}
      data-testid={`dashboard-count-${label}`}
    >
      <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function UnitDashboardPage() {
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const watchedRepositories = useSettingsStore((s) => s.watchedRepositories);

  const [mode, setMode] = useState<ScopeMode>("repo");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");

  const repos = useMemo(
    () => collectDashboardRepos({ watchedRepositories, pulls, issues }),
    [watchedRepositories, pulls, issues],
  );
  const orgs = useMemo(() => collectDashboardOrgs(repos), [repos]);

  const scopeRepos = useMemo(() => {
    if (mode === "org") {
      if (!selectedOrg) return null;
      return reposForOrg(repos, selectedOrg);
    }
    if (!selectedRepo) return null;
    return [selectedRepo];
  }, [mode, selectedOrg, selectedRepo, repos]);

  const counts = useMemo(() => {
    if (!scopeRepos) return null;
    return summarizeUnitDashboard({ pulls, issues, repos: scopeRepos });
  }, [pulls, issues, scopeRepos]);

  const scopeLabel =
    mode === "org"
      ? selectedOrg || null
      : selectedRepo || null;

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Dashboards"
        subtitle="Repo and org summaries from cached PRs, issues, and CI"
      />

      <div
        className="px-4 py-2 flex flex-wrap items-center gap-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-1" role="group" aria-label="Scope">
          {(
            [
              ["repo", "Repo"],
              ["org", "Org"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className="text-xs px-2.5 py-1 rounded-md"
              style={{
                backgroundColor:
                  mode === value ? "var(--bg-tertiary)" : "transparent",
                color: mode === value ? "var(--text-primary)" : "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                fontWeight: mode === value ? 600 : 500,
              }}
              aria-pressed={mode === value}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "repo" ? (
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            aria-label="Select repository"
            className="text-sm rounded-md px-2 py-1"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              minWidth: 220,
            }}
          >
            <option value="">Select repo…</option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            aria-label="Select organization"
            className="text-sm rounded-md px-2 py-1"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              minWidth: 180,
            }}
          >
            <option value="">Select org…</option>
            {orgs.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {repos.length === 0 ? (
          <EmptyState
            title="No repositories yet"
            subtitle="Watch a repo in Settings, or sync pulls/issues so they appear here."
          />
        ) : !scopeLabel || !counts ? (
          <EmptyState
            title={mode === "org" ? "Pick an organization" : "Pick a repository"}
            subtitle="Summaries use cached open PRs, issues, and CI status — no new API calls."
          />
        ) : (
          <div className="flex flex-col gap-4 max-w-2xl">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {mode === "org" ? (
                <>
                  Org <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{scopeLabel}</span>
                  {" · "}
                  {scopeRepos?.length ?? 0} repo{(scopeRepos?.length ?? 0) === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  Repo{" "}
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{scopeLabel}</span>
                </>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CountCard label="Open PRs" value={counts.openPrs} />
              <CountCard label="Open Issues" value={counts.openIssues} />
              <CountCard label="CI Failures" value={counts.ciFailures} tone="danger" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
