import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tabs, type TabItem } from "../components/common/Tabs";
import { StatusPill } from "../components/common/StatusPill";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { useDataStore } from "../stores/dataStore";
import { CiBanner } from "../components/pulls/CiBanner";
import { MergeReadinessBadge } from "../components/pulls/MergeReadinessBadge";
import { PrSummaryCard } from "../components/pulls/PrSummaryCard";
import { PrSidebar } from "../components/pulls/PrSidebar";
import { PrFooterBar } from "../components/pulls/PrFooterBar";
import { FileDiff, type DiffViewMode } from "../components/pulls/FileDiff";
import { FileTreePanel } from "../components/pulls/FileTreePanel";
import { usePullFilesQuery } from "../features/pulls/usePullFilesQuery";
import { filterFilesByQuery } from "../lib/fileTree";
import { getViewedSet, setViewed } from "../components/pulls/diff/DiffViewedStore";
import { openInEditor, readStoredEditor } from "../lib/openInEditor";

type DetailTab = "conversation" | "commits" | "checks" | "files";

const TABS: TabItem<DetailTab>[] = [
  { id: "conversation", label: "Conversation" },
  { id: "commits", label: "Commits" },
  { id: "checks", label: "Checks" },
  { id: "files", label: "Files changed" },
];

function fileAnchorId(filename: string): string {
  return `file-diff-${filename}`;
}

export default function PullDetailPage() {
  const { owner, repo, number } = useParams();
  const num = number ? Number.parseInt(number, 10) : undefined;
  const pullKey = `${owner}/${repo}#${number ?? ""}`;

  const pull = useDataStore((s) =>
    s.pulls.find((p) => p.repo === `${owner}/${repo}` && p.number === num),
  );

  const [tab, setTab] = useState<DetailTab>("conversation");
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [fileQuery, setFileQuery] = useState("");
  const [viewedSet, setViewedSet] = useState<Set<string>>(() => getViewedSet(pullKey));

  useEffect(() => {
    setViewedSet(getViewedSet(pullKey));
  }, [pullKey]);

  const { files, loading: filesLoading, error: filesError } = usePullFilesQuery(owner, repo, num);
  const visibleFiles = useMemo(() => filterFilesByQuery(files, fileQuery), [files, fileQuery]);

  const scrollToFile = (filename: string) => {
    document
      .getElementById(fileAnchorId(filename))
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const ciVariant = useMemo(() => {
    if (!pull) return null;
    if (pull.ciState === "failure" || pull.ciState === "error") return "failure" as const;
    if (pull.ciState === "pending" || pull.ciState === "in_progress") return "pending" as const;
    return null;
  }, [pull]);

  const statusLabel: "open" | "closed" | "merged" | "draft" = pull?.mergedAt
    ? "merged"
    : pull?.isDraft
      ? "draft"
      : pull?.state === "closed"
        ? "closed"
        : "open";

  if (!pull) {
    return (
      <div className="flex flex-col h-full">
        <header
          className="px-4 py-3 border-b flex items-center gap-2 text-xs"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Link to="/pulls" style={{ color: "var(--text-muted)" }}>
            Pull Requests
          </Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span>
            {owner}/{repo} #{number}
          </span>
        </header>
        <EmptyState
          title="Not in cache"
          subtitle="Sync or open the list to load this pull request."
        />
      </div>
    );
  }

  const toggleViewed = (filename: string, v: boolean) => {
    setViewed(pullKey, filename, v);
    setViewedSet(
      new Set(
        [...viewedSet].concat(v ? [filename] : []).filter((f) => (v ? true : f !== filename)),
      ),
    );
  };

  const handleOpenInEditor = async () => {
    const editor = readStoredEditor();
    try {
      await openInEditor(".", 1, editor);
    } catch {
      // ignore — command may not be allowlisted
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-4 py-3 border-b flex items-center gap-2 text-xs"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <Link to="/pulls" style={{ color: "var(--text-muted)" }}>
          Pull Requests
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <Link to={`/pulls?repo=${owner}/${repo}`} style={{ color: "var(--text-muted)" }}>
          {owner}/{repo}
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span>#{number}</span>
      </header>
      <div
        className="px-4 py-3 border-b flex items-center gap-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <StatusPill status={statusLabel} />
        {statusLabel === "open" && owner && repo && num !== undefined && (
          <MergeReadinessBadge owner={owner} repo={repo} number={num} />
        )}
        <h1
          className="text-base font-semibold flex-1 min-w-0 truncate"
          style={{ color: "var(--text-primary)" }}
          title={pull.title}
        >
          {pull.title}{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>#{pull.number}</span>
        </h1>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {pull.headRef} → {pull.baseRef}
        </span>
      </div>

      <Tabs items={TABS} activeId={tab} onChange={setTab} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {ciVariant && (
            <CiBanner
              variant={ciVariant}
              summary={
                ciVariant === "failure" ? "Some checks are failing." : "Checks are still running."
              }
            />
          )}
          {tab === "conversation" && (
            <PrSummaryCard
              author={pull.author}
              description={null}
              stats={{
                files: pull.changedFiles,
                additions: pull.additions,
                deletions: pull.deletions,
                commits: null,
              }}
            />
          )}
          {tab === "commits" && (
            <EmptyState
              title="Commit view pending"
              subtitle="Commit list will be wired in a follow-up milestone."
            />
          )}
          {tab === "checks" && (
            <EmptyState title="Checks view pending" subtitle="Check runs will be wired in M7." />
          )}
          {tab === "files" && (
            <div className="flex flex-col">
              <div
                className="flex items-center justify-end gap-2 px-4 pt-3"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="search"
                  aria-label="Search files and diff"
                  placeholder="Search files & diff…"
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.currentTarget.value)}
                  className="mr-auto w-64 rounded-md px-2.5 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
                <span className="text-xs">View:</span>
                <button
                  type="button"
                  onClick={() => setViewMode("unified")}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor:
                      viewMode === "unified" ? "var(--accent-blue)" : "var(--bg-tertiary)",
                    color: viewMode === "unified" ? "#fff" : "inherit",
                  }}
                >
                  Unified
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor:
                      viewMode === "split" ? "var(--accent-blue)" : "var(--bg-tertiary)",
                    color: viewMode === "split" ? "#fff" : "inherit",
                  }}
                >
                  Split
                </button>
              </div>
              {filesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              )}
              {filesError && <EmptyState title="Failed to load diff" subtitle={filesError} />}
              {!filesLoading && !filesError && (
                <div className="grid items-start" style={{ gridTemplateColumns: "220px 1fr" }}>
                  <div
                    className="sticky top-0 max-h-[70vh] overflow-y-auto border-r"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <FileTreePanel files={visibleFiles} onSelectFile={scrollToFile} />
                  </div>
                  <div className="min-w-0">
                    {visibleFiles.length === 0 && files.length > 0 ? (
                      <EmptyState
                        title="No matching files"
                        subtitle="Try a different search query."
                      />
                    ) : (
                      visibleFiles.map((f) => (
                        <div key={f.sha + f.filename} id={fileAnchorId(f.filename)}>
                          <FileDiff
                            file={f}
                            mode={viewMode}
                            viewed={viewedSet.has(f.filename)}
                            onToggleViewed={(v) => toggleViewed(f.filename, v)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <PrSidebar
          reviewers={pull.requestedReviewers}
          assignees={[]}
          labels={[]}
          milestone={null}
          linkedIssues={[]}
          checks={[]}
        />
      </div>
      <PrFooterBar
        canMerge={statusLabel === "open"}
        canApprove={statusLabel === "open"}
        htmlUrl={pull.htmlUrl ?? ""}
        onOpenInEditor={handleOpenInEditor}
      />
    </div>
  );
}
