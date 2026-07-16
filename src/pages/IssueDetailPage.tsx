import { Link, useParams } from "react-router-dom";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { StatusPill } from "../components/common/StatusPill";
import { IssueOriginalPost } from "../components/issues/IssueOriginalPost";
import { CommentThread } from "../components/issues/CommentThread";
import { IssueSidebar } from "../components/issues/IssueSidebar";
import { useIssueQuery } from "../features/issues/useIssueQuery";
import { useIssueCommentsQuery } from "../features/issues/useIssueCommentsQuery";

export default function IssueDetailPage() {
  const { owner, repo, number } = useParams();
  const num = number ? Number.parseInt(number, 10) : undefined;
  const { issue, loading, error } = useIssueQuery(owner, repo, num);
  const { comments } = useIssueCommentsQuery(owner, repo, num);

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
            />
          </div>
        </>
      )}
    </div>
  );
}
