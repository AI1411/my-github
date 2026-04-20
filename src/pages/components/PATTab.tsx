import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AuthUser {
  login: string;
  avatar_url: string;
}

interface Props {
  onSuccess: (user: AuthUser) => void;
}

type State = "idle" | "loading" | "error";

export function PATTab({ onSuccess }: Props) {
  const [token, setToken] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setState("loading");
    setError(null);
    try {
      const user = await invoke<AuthUser>("cmd_save_pat", { pat: token.trim() });
      onSuccess(user);
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const isScopesError = error?.startsWith("Missing required scopes:");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Create a token at{" "}
        <span style={{ color: "var(--accent-blue)" }}>
          github.com/settings/tokens
        </span>{" "}
        with{" "}
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
        scopes.
      </p>

      <div className="relative">
        <input
          type={showToken ? "text" : "password"}
          value={token}
          onChange={e => setToken(e.target.value)}
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
          onClick={() => setShowToken(v => !v)}
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
                Regenerate your token with the required scopes.
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
