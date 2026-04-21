import { Avatar } from "../common/Avatar";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { formatRelativeTime } from "../../lib/relativeTime";

export interface IssueOriginalPostProps {
  author: { login: string; avatarUrl: string };
  body: string | null;
  createdAt: string;
}

export function IssueOriginalPost({
  author,
  body,
  createdAt,
}: IssueOriginalPostProps) {
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
        <Avatar login={author.login} src={author.avatarUrl} size="sm" />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {author.login}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Author
        </span>
        <span
          className="ml-auto text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {formatRelativeTime(createdAt)}
        </span>
      </header>
      <div className="px-3 py-3">
        {body ? (
          <MarkdownRenderer source={body} />
        ) : (
          <p
            className="text-xs italic"
            style={{ color: "var(--text-muted)" }}
          >
            No description provided.
          </p>
        )}
      </div>
    </article>
  );
}
