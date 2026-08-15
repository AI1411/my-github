import { Toolbar } from "../components/common/Toolbar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { useReleasesQuery } from "../features/activity/useReleasesQuery";
import { formatRelativeTime } from "../lib/relativeTime";
import type { ReleaseSummary } from "../stores/dataStore";

async function openBrowser(url: string) {
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } catch {
    if (typeof window !== "undefined") window.open(url, "_blank");
  }
}

function releaseTitle(release: ReleaseSummary): string {
  if (release.name && release.name.trim().length > 0) return release.name;
  return release.tagName;
}

function ReleaseRow({ release }: { release: ReleaseSummary }) {
  const when = formatRelativeTime(release.publishedAt);
  return (
    <div
      role="row"
      tabIndex={0}
      data-testid={`release-row-${release.id}`}
      onClick={() => void openBrowser(release.htmlUrl)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void openBrowser(release.htmlUrl);
      }}
      className="px-4 py-3 border-b outline-none"
      style={{
        borderColor: "var(--border-subtle)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {releaseTitle(release)}
        </p>
        {release.prerelease && (
          <span
            className="text-[11px] px-1.5 py-0.5 rounded shrink-0"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent-orange, #f97316) 18%, transparent)",
              color: "var(--accent-orange, #f97316)",
            }}
          >
            Pre-release
          </span>
        )}
      </div>
      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
        {release.repo}
        {" · "}
        <span style={{ color: "var(--text-secondary)" }}>{release.tagName}</span>
        {when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}

export default function ReleasesPage() {
  const { releases, loading, error } = useReleasesQuery();

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Releases"
        subtitle="Latest releases across watched repositories"
      />
      {loading && releases.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && releases.length === 0 && (
        <EmptyState title="Failed to load releases" subtitle={error} />
      )}
      {!error && !loading && releases.length === 0 && (
        <EmptyState
          title="No releases"
          subtitle="Watch repositories with published releases to see them here"
        />
      )}
      {releases.length > 0 && (
        <div className="flex-1 overflow-y-auto" role="table" aria-label="Releases">
          {releases.map((release) => (
            <ReleaseRow key={release.id} release={release} />
          ))}
        </div>
      )}
    </div>
  );
}
