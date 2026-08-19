import { Link } from "react-router-dom";

type Props = {
  owner?: string;
  repo?: string;
  number?: string;
  /** When false, owner/repo is plain text (loading / cache-miss state). */
  linkRepo?: boolean;
};

export function PullDetailBreadcrumb({ owner, repo, number, linkRepo = true }: Props) {
  return (
    <header
      className="px-4 py-3 border-b flex items-center gap-2 text-xs"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <Link to="/pulls" style={{ color: "var(--text-muted)" }}>
        Pull Requests
      </Link>
      <span style={{ color: "var(--text-muted)" }}>/</span>
      {linkRepo && owner && repo ? (
        <Link to={`/pulls?repo=${owner}/${repo}`} style={{ color: "var(--text-muted)" }}>
          {owner}/{repo}
        </Link>
      ) : (
        <span>
          {owner}/{repo} #{number}
        </span>
      )}
      {linkRepo && number && (
        <>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span>#{number}</span>
        </>
      )}
    </header>
  );
}
