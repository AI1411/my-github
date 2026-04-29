import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { WorkflowRunRow } from "../components/ci/WorkflowRunRow";
import { useWorkflowRunsQuery } from "../features/ci/useWorkflowRunsQuery";
import { useDataStore } from "../stores/dataStore";
import type { WorkflowRunSummary } from "../stores/dataStore";

function useDerivedRepos(): string[] {
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  return useMemo(() => {
    const set = new Set<string>();
    pulls.forEach((p) => set.add(p.repo));
    issues.forEach((i) => set.add(i.repo));
    return Array.from(set).sort();
  }, [pulls, issues]);
}

export default function CiStatusPage() {
  const repos = useDerivedRepos();
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [branch, setBranch] = useState<string>("");

  const [owner, repoName] = selectedRepo.includes("/")
    ? (selectedRepo.split("/") as [string, string])
    : [null, null];

  const { runs, loading, error } = useWorkflowRunsQuery(owner, repoName, branch || null);

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
      <Toolbar title="CI Status" subtitle="Workflow runs for watched repos" />
      <div
        className="px-4 py-2 flex items-center gap-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-default)" }}
      >
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="text-sm rounded-md px-2 py-1"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <option value="">Select repo…</option>
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
      {!selectedRepo && (
        <EmptyState
          title="Select a repository"
          subtitle="Choose a repo to view its CI workflow runs"
        />
      )}
      {selectedRepo && loading && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {selectedRepo && error && <EmptyState title="Failed to load CI runs" subtitle={error} />}
      {selectedRepo && !loading && !error && runs.length === 0 && (
        <EmptyState title="No workflow runs" subtitle={`No runs found for ${selectedRepo}`} />
      )}
      <div className="flex-1 overflow-y-auto">
        {runs.map((run) => (
          <WorkflowRunRow
            key={run.id}
            run={run}
            onOpenLogs={run.conclusion === "failure" ? () => handleOpenLogs(run) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
