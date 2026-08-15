import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { Toolbar } from "../components/common/Toolbar";
import { usePullsQuery } from "../features/pulls/usePullsQuery";
import { formatRelativeTime } from "../lib/relativeTime";
import {
  buildOwnPrBlockers,
  filterPrBlockers,
  PR_BLOCKER_KINDS,
  PR_BLOCKER_LABELS,
  prBlockerDetailPath,
  togglePrBlockerFilter,
  type PrBlockerEntry,
  type PrBlockerKind,
} from "../lib/prBlockers";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

function BlockerBadges({ blockers }: { blockers: PrBlockerKind[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {blockers.map((kind) => {
        const isCi = kind === "ci_fail";
        const isChanges = kind === "changes_requested";
        const color = isCi
          ? "var(--accent-red)"
          : isChanges
            ? "var(--accent-orange, #f97316)"
            : "var(--accent-yellow, #eab308)";
        return (
          <span
            key={kind}
            className="text-[11px] px-2 py-0.5 rounded"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
              color,
            }}
          >
            {PR_BLOCKER_LABELS[kind]}
          </span>
        );
      })}
    </div>
  );
}

function BlockerRow({
  entry,
  onOpen,
}: {
  entry: PrBlockerEntry;
  onOpen: () => void;
}) {
  const { pull, blockers } = entry;
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="px-4 py-3 border-b outline-none"
      style={{
        borderColor: "var(--border-subtle)",
        cursor: "pointer",
      }}
      data-testid={`blocker-row-${pull.repo}-${pull.number}`}
    >
      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
        {pull.title}
      </p>
      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
        {pull.repo} #{pull.number}
        {" · "}
        {formatRelativeTime(pull.updatedAt)}
      </p>
      <BlockerBadges blockers={blockers} />
    </div>
  );
}

export default function MyBlockersPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user?.login ?? null);
  const staleThresholds = useSettingsStore((s) => s.staleThresholds);
  const { pulls, loading, error } = usePullsQuery({ tab: "created", state: "open" });
  const [activeKinds, setActiveKinds] = useState<PrBlockerKind[]>([]);

  const blocked = useMemo(
    () =>
      buildOwnPrBlockers({
        pulls,
        currentUser,
        thresholds: staleThresholds,
      }),
    [pulls, currentUser, staleThresholds],
  );

  const visible = useMemo(
    () => filterPrBlockers(blocked, activeKinds),
    [blocked, activeKinds],
  );

  const openEntry = (entry: PrBlockerEntry) => {
    const path = prBlockerDetailPath(entry.pull);
    if (path) navigate(path);
  };

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="My blockers"
        subtitle="CI failing · Changes requested · Stale on your open PRs"
      />

      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
        role="toolbar"
        aria-label="Blocker filters"
      >
        {PR_BLOCKER_KINDS.map((kind) => {
          const active = activeKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveKinds((prev) => togglePrBlockerFilter(prev, kind))}
              className="px-2.5 py-1 rounded-full text-xs"
              style={{
                backgroundColor: active ? "var(--accent-blue)" : "var(--bg-tertiary)",
                color: active ? "#ffffff" : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {PR_BLOCKER_LABELS[kind]}
            </button>
          );
        })}
        <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>
          {visible.length} of {blocked.length}
        </span>
      </div>

      {loading && pulls.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <EmptyState title="Failed to load blockers" subtitle={error} />}
      {!error && !loading && blocked.length === 0 && (
        <EmptyState
          title="No blockers"
          subtitle="Your open PRs look clear — no CI fails, change requests, or stale items."
        />
      )}
      {!error && blocked.length > 0 && visible.length === 0 && (
        <EmptyState
          title="No matches"
          subtitle="No blocked PRs match the selected filters."
        />
      )}
      {visible.length > 0 && (
        <div className="flex-1 overflow-y-auto" role="table" aria-label="Blocked pull requests">
          {visible.map((entry) => (
            <BlockerRow
              key={`${entry.pull.repo}#${entry.pull.number}`}
              entry={entry}
              onOpen={() => openEntry(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
