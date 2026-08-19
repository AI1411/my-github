import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_GITHUB_WEB_BASE,
  normalizeGithubApiBaseUrl,
  normalizeGithubWebBaseUrl,
} from "../../lib/githubHost";
import { openInBrowser } from "../../lib/openInBrowser";

interface AuthUser {
  login: string;
  avatar_url: string;
}

interface Props {
  onSuccess: (user: AuthUser, hostWebBase: string) => void;
  /** When true, show the custom host URL field (Settings → Add account). */
  showHostField?: boolean;
}

type State = "idle" | "loading" | "error";

const PAT_CREATE_QUERY = "scopes=repo,read:user,notifications&description=my-github";

export function buildPatCreateUrl(hostUrl: string): string {
  const webBase = hostUrl.trim() ? normalizeGithubWebBaseUrl(hostUrl) : DEFAULT_GITHUB_WEB_BASE;
  return `${webBase}/settings/tokens/new?${PAT_CREATE_QUERY}`;
}

function CreateTokenLink({ hostUrl }: { hostUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => void openInBrowser(buildPatCreateUrl(hostUrl))}
      className="underline hover:opacity-80"
      style={{ color: "var(--accent-blue)" }}
    >
      Create token
    </button>
  );
}

export function PATTab({ onSuccess, showHostField = true }: Props) {
  const [token, setToken] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setState("loading");
    setError(null);
    const webBase = hostUrl.trim() ? normalizeGithubWebBaseUrl(hostUrl) : DEFAULT_GITHUB_WEB_BASE;
    const apiBase = normalizeGithubApiBaseUrl(webBase);
    try {
      const user = await invoke<AuthUser>("cmd_save_pat", {
        pat: token.trim(),
        baseUrl: apiBase === "https://api.github.com" ? null : apiBase,
      });
      onSuccess(user, webBase);
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const isScopesError = error?.startsWith("Missing required scopes:");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Create a token at <CreateTokenLink hostUrl={hostUrl} /> with{" "}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
        >
          repo
        </code>
        ,{" "}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
        >
          read:user
        </code>
        , and{" "}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
        >
          notifications
        </code>{" "}
        scopes. Fine-grained tokens with repository access may omit the classic scope header — those
        are accepted when GitHub returns an empty{" "}
        <code className="text-[11px]">X-OAuth-Scopes</code> list. For GitHub Enterprise Server,
        enter the host URL below.
      </p>

      {showHostField && (
        <div>
          <label
            htmlFor="ghes-host-url"
            className="mb-1.5 block text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Host URL (optional)
          </label>
          <input
            id="ghes-host-url"
            type="url"
            value={hostUrl}
            onChange={(e) => setHostUrl(e.target.value)}
            placeholder="https://github.com or https://github.example.com"
            className="w-full py-2.5 px-3 rounded-md text-sm font-mono"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              outline: "none",
            }}
            disabled={state === "loading"}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Leave blank for github.com. GHES hosts map to{" "}
            <code className="text-[11px]">/api/v3</code>.
          </p>
        </div>
      )}

      <div className="relative">
        <input
          type={showToken ? "text" : "password"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          className="w-full py-2.5 px-3 pr-16 rounded-md text-sm font-mono"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: `1px solid ${error ? "var(--accent-red)" : "var(--border-default)"}`,
            outline: "none",
          }}
          disabled={state === "loading"}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShowToken((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded"
          style={{ color: "var(--text-muted)" }}
          tabIndex={-1}
        >
          {showToken ? "Hide" : "Show"}
        </button>
      </div>

      {error && (
        <div
          className="p-3 rounded-md text-sm space-y-1"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-red) 10%, transparent)",
            color: "var(--accent-red)",
            border: "1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)",
          }}
        >
          {isScopesError ? (
            <>
              <p className="font-medium">Insufficient scopes</p>
              <p>{error.replace("Missing required scopes: ", "Required: ")}</p>
              <p
                className="text-xs"
                style={{
                  color: "color-mix(in srgb, var(--accent-red) 70%, var(--text-secondary))",
                }}
              >
                Regenerate your token with the required scopes, or{" "}
                <CreateTokenLink hostUrl={hostUrl} />.
              </p>
            </>
          ) : (
            <p>{error}</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "loading" || !token.trim()}
        className="w-full py-2.5 px-4 rounded-md text-sm font-medium transition-opacity"
        style={{
          backgroundColor: "var(--accent-blue)",
          color: "white",
          opacity: state === "loading" || !token.trim() ? 0.5 : 1,
          cursor: state === "loading" || !token.trim() ? "not-allowed" : "pointer",
        }}
      >
        {state === "loading" ? "Verifying…" : "Connect"}
      </button>
    </form>
  );
}
