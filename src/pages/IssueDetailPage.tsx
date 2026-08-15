import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { StatusPill } from "../components/common/StatusPill";
import { Button } from "../components/common/Button";
import { IssueOriginalPost } from "../components/issues/IssueOriginalPost";
import { CommentThread } from "../components/issues/CommentThread";
import { IssueSidebar } from "../components/issues/IssueSidebar";
import { useIssueQuery } from "../features/issues/useIssueQuery";
import { useIssueCommentsQuery } from "../features/issues/useIssueCommentsQuery";
import { useDataStore, type IssueSummary } from "../stores/dataStore";

export default function IssueDetailPage() {
  const { owner, repo, number } = useParams();
  const num = number ? Number.parseInt(number, 10) : undefined;
  const { issue: fetched, loading, error } = useIssueQuery(owner, repo, num);
  const { comments } = useIssueCommentsQuery(owner, repo, num);
  const patchIssue = useDataStore((s) => s.patchIssue);
  const [issue, setIssue] = useState<IssueSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setIssue(fetched);
  }, [fetched]);

  const updateIssue = async (payload: {
    state?: string;
    labels?: string[];
    assignees?: string[];
  }) => {
    if (!owner || !repo || !num) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await invoke<IssueSummary>("cmd_update_issue", {
        owner,
        repo,
        number: num,
        state: payload.state ?? null,
        labels: payload.labels ?? null,
        assignees: payload.assignees ?? null,
      });
      setIssue(updated);
      patchIssue(updated.repo, updated.number, {
        state: updated.state,
        labels: updated.labels,
        assignees: updated.assignees,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-4 py-3 border-b flex items-center gap-2 text-xs"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <Link to="/issues" style={{ color: "var(--text-muted)" }}>
          Issues
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <Link to={`/issues?repo=${owner}/${repo}`} style={{ color: "var(--text-muted)" }}>
          {owner}/{repo}
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span>#{number}</span>
      </header>

      {loading && !issue && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {error && !issue && <EmptyState title="Failed to load issue" subtitle={error} />}

      {issue && (
        <>
          <div
            className="px-4 py-3 border-b flex items-center gap-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <StatusPill status={issue.state === "closed" ? "closed" : "open"} />
            <h1
              className="text-base font-semibold flex-1 min-w-0 truncate"
              style={{ color: "var(--text-primary)" }}
              title={issue.title}
            >
              {issue.title}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>#{issue.number}</span>
            </h1>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <IssueOriginalPost
                author={{
                  login: issue.author ?? "unknown",
                  avatarUrl: "",
                }}
                body={issue.body}
                createdAt={issue.updatedAt}
              />
              <CommentThread comments={comments} />
            </div>
            <IssueSidebar
              assignees={issue.assignees}
              labels={issue.labels}
              milestone={
                issue.milestone
                  ? {
                      title: issue.milestone,
                      openIssues: 0,
                      closedIssues: 0,
                    }
                  : null
              }
              linkedPrs={[]}
              participants={[]}
              subscribed={false}
              onAddAssignee={() => {
                const login = window.prompt("Assignee login");
                if (!login) return;
                void updateIssue({
                  assignees: [...issue.assignees.map((a) => a.login), login.trim()],
                });
              }}
              onRemoveAssignee={(login) => {
                void updateIssue({
                  assignees: issue.assignees.map((a) => a.login).filter((l) => l !== login),
                });
              }}
              onAddLabel={() => {
                const name = window.prompt("Label name");
                if (!name) return;
                void updateIssue({
                  labels: [...issue.labels.map((l) => l.name), name.trim()],
                });
              }}
              onRemoveLabel={(name) => {
                void updateIssue({
                  labels: issue.labels.map((l) => l.name).filter((n) => n !== name),
                });
              }}
            />
          </div>

          <footer
            className="flex items-center justify-end gap-2 px-4 py-3 border-t"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            {actionError && (
              <span className="mr-auto text-xs" style={{ color: "var(--accent-red)" }} role="alert">
                {actionError}
              </span>
            )}
            {issue.state === "open" ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void updateIssue({ state: "closed" })}
              >
                {busy ? "Working…" : "Close issue"}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void updateIssue({ state: "open" })}
              >
                {busy ? "Working…" : "Reopen issue"}
              </Button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
