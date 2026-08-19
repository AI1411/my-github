import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { Toolbar } from "../components/common/Toolbar";
import { buildFileJumpUrl } from "../lib/codeSearch";
import { openInBrowser } from "../lib/openInBrowser";
import { useSettingsStore } from "../stores/settingsStore";

export interface CodeSearchHit {
  name: string;
  path: string;
  sha: string;
  htmlUrl: string;
  snippet: string;
}

function ResultRow({ hit }: { hit: CodeSearchHit }) {
  return (
    <div
      role="row"
      tabIndex={0}
      data-testid={`code-hit-${hit.sha}`}
      onClick={() => void openInBrowser(hit.htmlUrl)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void openInBrowser(hit.htmlUrl);
      }}
      className="px-4 py-3 border-b outline-none"
      style={{
        borderColor: "var(--border-subtle)",
        cursor: "pointer",
      }}
    >
      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
        {hit.path}
      </p>
      {hit.snippet ? (
        <pre
          className="text-xs mt-1.5 whitespace-pre-wrap break-all font-mono leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {hit.snippet}
        </pre>
      ) : null}
    </div>
  );
}

export default function CodeSearchPage() {
  const watchedRepositories = useSettingsStore((s) => s.watchedRepositories);
  const [repo, setRepo] = useState(watchedRepositories[0] ?? "");
  const [query, setQuery] = useState("");
  const [filePath, setFilePath] = useState("");
  const [results, setResults] = useState<CodeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const r = repo.trim();
    const q = query.trim();
    if (!r || !q) {
      setError("Choose a repository and enter a search query.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const hits = await invoke<CodeSearchHit[]>("cmd_search_code", {
        repo: r,
        query: q,
      });
      setResults(hits);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function jumpToFile() {
    const url = buildFileJumpUrl(repo, filePath);
    if (!url) {
      setError("Choose a repository and enter a file path to jump.");
      return;
    }
    setError(null);
    void openInBrowser(url);
  }

  const inputStyle = {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  } as const;

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        title="Code search"
        subtitle="Search file contents in a watched repo, or jump to a path on GitHub"
      />

      <div
        className="px-6 py-4 border-b flex flex-col gap-3"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Repository
            <select
              data-testid="code-search-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="text-sm px-3 py-2 rounded-md min-w-[220px]"
              style={inputStyle}
            >
              <option value="">Select repo…</option>
              {watchedRepositories.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label
            className="flex flex-col gap-1 text-xs flex-1 min-w-[180px]"
            style={{ color: "var(--text-muted)" }}
          >
            Query
            <input
              data-testid="code-search-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="function name, path:src, language:…"
              className="text-sm px-3 py-2 rounded-md"
              style={inputStyle}
            />
          </label>

          <button
            type="button"
            data-testid="code-search-submit"
            onClick={() => void runSearch()}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-md font-medium"
            style={{
              backgroundColor: "var(--accent-blue)",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label
            className="flex flex-col gap-1 text-xs flex-1 min-w-[180px]"
            style={{ color: "var(--text-muted)" }}
          >
            File jump (path)
            <input
              data-testid="code-search-path"
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") jumpToFile();
              }}
              placeholder="src/lib.rs"
              className="text-sm px-3 py-2 rounded-md"
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            data-testid="code-search-jump"
            onClick={jumpToFile}
            className="text-sm px-4 py-2 rounded-md font-medium"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            Open on GitHub
          </button>
        </div>

        {watchedRepositories.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Add watched repositories in Settings to enable repo selection.
          </p>
        )}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Code search failed" subtitle={error} />
      )}

      {!loading && !error && searched && results.length === 0 && (
        <EmptyState title="No matches" subtitle="Try a different query or repository" />
      )}

      {!loading && !error && results.length > 0 && (
        <div className="flex-1 overflow-y-auto" role="table" aria-label="Code search results">
          {results.map((hit) => (
            <ResultRow key={`${hit.sha}-${hit.path}`} hit={hit} />
          ))}
        </div>
      )}

      {!loading && !error && !searched && (
        <EmptyState
          title="Search code"
          subtitle="Pick a repo, enter a query, and press Search — or jump straight to a file path"
        />
      )}
    </div>
  );
}
