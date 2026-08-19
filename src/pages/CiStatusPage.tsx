import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { WorkflowRunRow } from "../components/ci/WorkflowRunRow";
import { useCrossRepoWorkflowRunsQuery } from "../features/ci/useCrossRepoWorkflowRunsQuery";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { WorkflowRunSummary } from "../stores/dataStore";

function collectRepos(
  watched: string[],
  pulls: { repo: string }[],
  issues: { repo: string }[],
): string[] {
  const set = new Set<string>(watched);
  pulls.forEach((p) => set.add(p.repo));
  issues.forEach((i) => set.add(i.repo));
  return Array.from(set).sort();
}

export default function CiStatusPage() {
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const watchedRepositories = useSettingsStore((s) => s.watchedRepositories);
  const repos = useMemo(
    () => collectRepos(watchedRepositories, pulls, issues),
    [watchedRepositories, pulls, issues],
  );

  const [repoFilter, setRepoFilter] = useState<string>("");
  const [branch, setBranch] = useState<string>("");

  const queryRepos = useMemo(() => (repoFilter ? [repoFilter] : repos), [repoFilter, repos]);

  const { runs, loading, error, refetch } = useCrossRepoWorkflowRunsQuery(
    queryRepos,
    branch || null,
  );

  const [rerunningRunId, setRerunningRunId] = useState<number | null>(null);

  const failureCount = runs.filter((r) => r.conclusion === "failure").length;

  const handleRerunFailed = async (run: WorkflowRunSummary) => {
    const [runOwner, runRepo] = run.repo.split("/");
    if (!runOwner || !runRepo) return;
    setRerunningRunId(run.id);
    try {
      await invoke("cmd_rerun_workflow_failed_jobs", {
        owner: runOwner,
        repo: runRepo,
        runId: run.id,
      });
      refetch();
    } finally {
      setRerunningRunId(null);
    }
  };

  const handleOpenLogs = (run: WorkflowRunSummary) => {
    const [runOwner, runRepo] = run.repo.split("/");
    if (!runOwner || !runRepo) return;
    void invoke("cmd_open_run_logs", {
      owner: runOwner,
      repo: runRepo,
      runId: run.id,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="CI Status"
        subtitle={
          repos.length > 0
            ? `${failureCount > 0 ? `${failureCount} failing · ` : ""}${repos.length} repo${repos.length === 1 ? "" : "s"}`
            : "Workflow runs for watched repos"
        }
      />
      <div
        className="px-4 py-2 flex items-center gap-2 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: "var(--border-default)" }}
      >
        <select
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          aria-label="Filter by repository"
          className="text-sm rounded-md px-2 py-1"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <option value="">All repos</option>
          {repos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Branch (optional)"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="text-sm rounded-md px-2 py-1"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            width: 180,
          }}
        />
      </div>
      {repos.length === 0 && (
        <EmptyState
          title="No repositories to monitor"
          subtitle="Watch repos in Settings, or sync pull requests and issues so their repos appear here."
        />
      )}
      {repos.length > 0 && loading && runs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {repos.length > 0 && error && <EmptyState title="Failed to load CI runs" subtitle={error} />}
      {repos.length > 0 && !loading && !error && runs.length === 0 && (
        <EmptyState
          title="No workflow runs"
          subtitle={
            repoFilter ? `No runs found for ${repoFilter}` : "No recent runs across watched repos"
          }
        />
      )}
      <div className="flex-1 overflow-y-auto">
        {runs.map((run) => (
          <WorkflowRunRow
            key={`${run.repo}-${run.id}`}
            run={run}
            onRerunFailed={
              run.conclusion === "failure" ? () => void handleRerunFailed(run) : undefined
            }
            rerunning={rerunningRunId === run.id}
            onOpenLogs={run.conclusion === "failure" ? () => handleOpenLogs(run) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
