import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Tabs, type TabItem } from "../components/common/Tabs";
import { StatusPill } from "../components/common/StatusPill";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useCloseDetailShortcut } from "../hooks/useCloseDetailShortcut";
import { useInboxQueueAdvance } from "../hooks/useInboxQueueAdvance";
import { useFileDiffNav } from "../hooks/useFileDiffNav";
import { useOpenInBrowserShortcut } from "../hooks/useOpenInBrowserShortcut";
import { CiBanner } from "../components/pulls/CiBanner";
import { CommentDraftPanel } from "../components/pulls/CommentDraftPanel";
import { ReviewCommentsPanel } from "../components/pulls/ReviewCommentsPanel";
import { MergeReadinessBadge } from "../components/pulls/MergeReadinessBadge";
import { ReviewContextPanel } from "../components/pulls/ReviewContextPanel";
import { PrLlmSummaryPanel } from "../components/pulls/PrLlmSummaryPanel";
import { PrSummaryCard } from "../components/pulls/PrSummaryCard";
import { PrSidebar } from "../components/pulls/PrSidebar";
import { PrFooterBar } from "../components/pulls/PrFooterBar";
import { FileDiff, type DiffViewMode } from "../components/pulls/FileDiff";
import { FileTreePanel } from "../components/pulls/FileTreePanel";
import { CommitsTab } from "../components/pulls/CommitsTab";
import { ChecksTab } from "../components/pulls/ChecksTab";
import { UnresolvedCommentsList } from "../components/pulls/UnresolvedCommentsList";
import type { ReviewCommentSummary } from "../components/pulls/ReviewCommentsPanel";
import { usePullFilesQuery } from "../features/pulls/usePullFilesQuery";
import { usePullQuery } from "../features/pulls/usePullQuery";
import { filterFilesByQuery } from "../lib/fileTree";
import { getViewedSet, setViewed } from "../components/pulls/diff/DiffViewedStore";
import { openPrInEditor, readStoredEditor } from "../lib/openInEditor";

type DetailTab = "conversation" | "commits" | "checks" | "files";

const TABS: TabItem<DetailTab>[] = [
  { id: "conversation", label: "Conversation" },
  { id: "commits", label: "Commits" },
  { id: "checks", label: "Checks" },
  { id: "files", label: "Files changed" },
];

function parseTab(raw: string | null): DetailTab {
  if (raw === "commits" || raw === "checks" || raw === "files" || raw === "conversation") {
    return raw;
  }
  return "conversation";
}

function fileAnchorId(filename: string): string {
  return `file-diff-${filename}`;
}

export default function PullDetailPage() {
  useCloseDetailShortcut();
  useInboxQueueAdvance();
  const { owner, repo, number } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const num = number ? Number.parseInt(number, 10) : undefined;
  const pullKey = `${owner}/${repo}#${number ?? ""}`;

  const cachedPull = useDataStore((s) =>
    s.pulls.find((p) => p.repo === `${owner}/${repo}` && p.number === num),
  );
  const shouldFetchPull = !cachedPull && !!owner && !!repo && num !== undefined && Number.isFinite(num);
  const {
    pull: fetchedPull,
    loading: pullLoading,
    error: pullError,
  } = usePullQuery(owner, repo, num, shouldFetchPull);
  const pull = cachedPull ?? fetchedPull;
  useOpenInBrowserShortcut(pull?.htmlUrl ?? null);
  const accountId = useAuthStore((s) => s.user?.login ?? "");
  const repoFull = owner && repo ? `${owner}/${repo}` : "";
  const pinned = useSettingsStore((s) => {
    const pins = s.pinnedPullsByAccount[accountId];
    if (!pins || num === undefined) return false;
    return pins.some((p) => p.repo === repoFull && p.number === num);
  });
  const togglePinnedPull = useSettingsStore((s) => s.togglePinnedPull);
  const recordRecentPull = useSettingsStore((s) => s.recordRecentPull);
  const localLlm = useSettingsStore((s) => s.localLlm);
  const currentUser = useAuthStore((s) => s.user?.login ?? null);
  const patchPullReviewState = useDataStore((s) => s.patchPullReviewState);
  const patchPullState = useDataStore((s) => s.patchPullState);
  const patchPullDraft = useDataStore((s) => s.patchPullDraft);
  const patchPullReviewers = useDataStore((s) => s.patchPullReviewers);

  const [tab, setTab] = useState<DetailTab>(() => parseTab(searchParams.get("tab")));
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [fileQuery, setFileQuery] = useState("");
  const [viewedSet, setViewedSet] = useState<Set<string>>(() => getViewedSet(pullKey));
  const [readinessKey, setReadinessKey] = useState(0);
  const [reviewComments, setReviewComments] = useState<ReviewCommentSummary[]>([]);

  useEffect(() => {
    setViewedSet(getViewedSet(pullKey));
    setReviewComments([]);
  }, [pullKey]);

  useEffect(() => {
    if (!accountId || !repoFull || num === undefined || !Number.isFinite(num)) return;
    recordRecentPull(accountId, {
      repo: repoFull,
      number: num,
      title: pull?.title ?? `${repoFull}#${num}`,
    });
  }, [accountId, repoFull, num, pull?.title, recordRecentPull]);

  useEffect(() => {
    const next = parseTab(searchParams.get("tab"));
    setTab(next);
  }, [searchParams]);

  const handleTabChange = (next: DetailTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "conversation") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const { files, loading: filesLoading, error: filesError } = usePullFilesQuery(owner, repo, num);
  const visibleFiles = useMemo(() => filterFilesByQuery(files, fileQuery), [files, fileQuery]);

  const scrollToFile = (filename: string) => {
    document
      .getElementById(fileAnchorId(filename))
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  useFileDiffNav(
    visibleFiles.map((file) => file.filename),
    tab === "files",
    scrollToFile,
  );

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

  const isOwnPull = !!currentUser && pull?.author === currentUser;
  const canReview = statusLabel === "open" && !isOwnPull;
  const reviewDisabledReason = !pull
    ? null
    : statusLabel !== "open"
      ? "Only open pull requests can be reviewed"
      : isOwnPull
        ? "You cannot review your own pull request"
        : null;

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
        {pullLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <EmptyState
            title={pullError ? "Failed to load pull request" : "Not in cache"}
            subtitle={
              pullError ?? "Sync or open the list to load this pull request."
            }
          />
        )}
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

  const preferWorktree = useSettingsStore((s) => s.preferWorktree);
  const repoLocalPaths = useSettingsStore((s) => s.repoLocalPaths);
  const [editorError, setEditorError] = useState<string | null>(null);

  const handleOpenInEditor = async () => {
    const editor = readStoredEditor();
    const localPath = repoFull ? repoLocalPaths[repoFull] : undefined;
    if (!localPath) {
      setEditorError(`Map a local path for ${repoFull || "this repo"} in Settings → Repositories.`);
      return;
    }
    setEditorError(null);
    try {
      await openPrInEditor({
        localPath,
        headRef: pull.headRef,
        editor,
        useWorktree: preferWorktree,
      });
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
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
          <MergeReadinessBadge owner={owner} repo={repo} number={num} refreshKey={readinessKey} />
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
        {repoFull && num !== undefined && (
          <button
            type="button"
            aria-label={pinned ? "Unpin pull request" : "Pin pull request"}
            aria-pressed={pinned}
            onClick={() => togglePinnedPull(accountId, repoFull, num)}
            className="text-xs px-2.5 py-1 rounded-md font-medium"
            style={{
              backgroundColor: pinned ? "var(--accent-blue)" : "var(--bg-tertiary)",
              color: pinned ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {pinned ? "Pinned" : "Pin"}
          </button>
        )}
      </div>

      <Tabs items={TABS} activeId={tab} onChange={handleTabChange} />

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
            <>
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
              <PrLlmSummaryPanel
                title={pull.title}
                body={null}
                files={files.map((f) => ({
                  filename: f.filename,
                  status: f.status,
                  additions: f.additions,
                  deletions: f.deletions,
                }))}
                settings={localLlm}
              />
              {owner && repo && num !== undefined && (
                <ReviewContextPanel
                  owner={owner}
                  repo={repo}
                  number={num}
                  reviewState={pull.reviewState}
                />
              )}
              <ReviewCommentsPanel owner={owner ?? ""} repo={repo ?? ""} number={num ?? 0} />
              <CommentDraftPanel
                owner={owner ?? ""}
                repo={repo ?? ""}
                number={num ?? 0}
                htmlUrl={pull.htmlUrl}
                canComment={canReview}
                disabledReason={reviewDisabledReason}
                onSubmitted={() => setReadinessKey((k) => k + 1)}
              />
            </>
          )}
          {tab === "commits" && owner && repo && num !== undefined && (
            <CommitsTab owner={owner} repo={repo} number={num} />
          )}
          {tab === "checks" && owner && repo && num !== undefined && (
            <ChecksTab owner={owner} repo={repo} number={num} />
          )}
          {tab === "files" && (
            <div className="flex flex-col">
              {owner && repo && num !== undefined && (
                <UnresolvedCommentsList
                  owner={owner}
                  repo={repo}
                  number={num}
                  onJumpToFile={scrollToFile}
                  onCommentsLoaded={setReviewComments}
                />
              )}
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
                            reviewComments={reviewComments}
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
          onAddReviewer={() => {
            const login = window.prompt("Reviewer login");
            if (!login || !owner || !repo) return;
            void invoke<string[]>("cmd_update_pull_reviewers", {
              owner,
              repo,
              number: pull.number,
              add: [login.trim()],
              remove: null,
            }).then((logins) => {
              patchPullReviewers(
                pull.repo,
                pull.number,
                logins.map((l) => ({ login: l, avatarUrl: "" })),
              );
            });
          }}
          onRemoveReviewer={(login) => {
            if (!owner || !repo) return;
            void invoke<string[]>("cmd_update_pull_reviewers", {
              owner,
              repo,
              number: pull.number,
              add: null,
              remove: [login],
            }).then((logins) => {
              patchPullReviewers(
                pull.repo,
                pull.number,
                logins.map((l) => ({ login: l, avatarUrl: "" })),
              );
            });
          }}
        />
      </div>
      {editorError && (
        <div
          role="alert"
          className="px-4 py-2 text-xs"
          style={{ color: "var(--accent-red)", borderTop: "1px solid var(--border-subtle)" }}
        >
          {editorError}
        </div>
      )}
      <PrFooterBar
        owner={owner ?? ""}
        repo={repo ?? ""}
        number={pull.number}
        canMerge={statusLabel === "open"}
        canApprove={canReview}
        canClose={statusLabel === "open" || statusLabel === "draft"}
        canReopen={statusLabel === "closed"}
        canToggleDraft={statusLabel === "open" || statusLabel === "draft"}
        isDraft={statusLabel === "draft"}
        approveDisabledReason={reviewDisabledReason}
        htmlUrl={pull.htmlUrl ?? ""}
        onOpenInEditor={handleOpenInEditor}
        checkout={{ number: pull.number, headRef: pull.headRef }}
        onReviewSubmitted={(_event, reviewState) => {
          if (reviewState) patchPullReviewState(pull.repo, pull.number, reviewState);
          setReadinessKey((k) => k + 1);
        }}
        onMerged={() => {
          patchPullState(pull.repo, pull.number, "merged");
          setReadinessKey((k) => k + 1);
        }}
        onStateChanged={(state) => {
          patchPullState(pull.repo, pull.number, state);
          setReadinessKey((k) => k + 1);
        }}
        onDraftChanged={(draft) => {
          patchPullDraft(pull.repo, pull.number, draft);
          setReadinessKey((k) => k + 1);
        }}
      />
    </div>
  );
}
