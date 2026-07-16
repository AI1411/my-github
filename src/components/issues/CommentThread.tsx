import { Avatar } from "../common/Avatar";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { formatRelativeTime } from "../../lib/relativeTime";
import type { IssueCommentSummary } from "../../features/issues/useIssueCommentsQuery";

export interface CommentThreadProps {
  comments: IssueCommentSummary[];
}

function badgeFor(assoc: string | null): string | null {
  switch (assoc) {
    case "OWNER":
      return "Author";
    case "COLLABORATOR":
      return "Collaborator";
    case "MEMBER":
      return "Maintainer";
    default:
      return null;
  }
}

function CommentCard({ c }: { c: IssueCommentSummary }) {
  const badge = badgeFor(c.authorAssociation);
  return (
    <article
      className="mx-4 my-3 rounded border overflow-hidden"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <header
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <Avatar login={c.author.login} src={c.author.avatarUrl} size="sm" />
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {c.author.login}
        </span>
        {badge && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {badge}
          </span>
        )}
        <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
          {formatRelativeTime(c.createdAt)}
        </span>
      </header>
      <div className="px-3 py-3">
        <MarkdownRenderer source={c.body} />
      </div>
    </article>
  );
}

export function CommentThread({ comments }: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <p className="px-4 py-6 text-xs text-center" style={{ color: "var(--text-muted)" }}>
        No comments yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {comments.map((c) => (
        <CommentCard key={c.id} c={c} />
      ))}
    </div>
  );
}
