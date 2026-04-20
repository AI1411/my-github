import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AuthUser {
  login: string;
  avatar_url: string;
}

interface Props {
  onSuccess: (user: AuthUser) => void;
}

type State = "idle" | "loading" | "waiting" | "error";

export function DeviceFlowTab({ onSuccess }: Props) {
  const [state, setState] = useState<State>("idle");
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleStart = async () => {
    setState("loading");
    setError(null);
    try {
      const result = await invoke<DeviceCodeResponse>("cmd_start_device_flow");
      setDeviceCode(result);
      setState("waiting");
      pollForAuth(result);
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const pollForAuth = async (dc: DeviceCodeResponse) => {
    try {
      const user = await invoke<AuthUser>("cmd_poll_device_flow", {
        deviceCode: dc,
      });
      onSuccess(user);
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const copyToClipboard = async (text: string, type: "code" | "url") => {
    await navigator.clipboard.writeText(text);
    if (type === "code") {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } else {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  if (state === "idle" || state === "loading") {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Authenticate securely without entering your password. GitHub will give
          you a short code to enter on their website.
        </p>
        <button
          onClick={handleStart}
          disabled={state === "loading"}
          className="w-full py-2.5 px-4 rounded-md text-sm font-medium transition-opacity"
          style={{
            backgroundColor: "var(--accent-blue)",
            color: "white",
            opacity: state === "loading" ? 0.6 : 1,
            cursor: state === "loading" ? "not-allowed" : "pointer",
          }}
        >
          {state === "loading" ? "Starting…" : "Start Device Flow"}
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-4">
        <div
          className="p-3 rounded-md text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-red) 10%, transparent)",
            color: "var(--accent-red)",
            border: "1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)",
          }}
        >
          {error}
        </div>
        <button
          onClick={() => setState("idle")}
          className="w-full py-2.5 px-4 rounded-md text-sm font-medium"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Step 1 — Enter this code on GitHub
        </p>
        <div
          className="p-4 rounded-md text-center font-mono text-3xl font-bold tracking-widest"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--accent-blue)",
            border: "1px solid var(--border-default)",
          }}
        >
          {deviceCode!.user_code}
        </div>
        <button
          onClick={() => copyToClipboard(deviceCode!.user_code, "code")}
          className="mt-2 w-full py-2 px-3 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: codeCopied
              ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
              : "var(--bg-tertiary)",
            color: codeCopied ? "var(--accent-green)" : "var(--text-primary)",
          }}
        >
          {codeCopied ? "Copied!" : "Copy Code"}
        </button>
      </div>

      <div>
        <p
          className="text-xs font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Step 2 — Authorize at this URL
        </p>
        <div
          className="p-3 rounded-md text-sm text-center break-all"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--accent-blue)",
            border: "1px solid var(--border-default)",
          }}
        >
          {deviceCode!.verification_uri}
        </div>
        <button
          onClick={() => copyToClipboard(deviceCode!.verification_uri, "url")}
          className="mt-2 w-full py-2 px-3 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: urlCopied
              ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
              : "var(--bg-tertiary)",
            color: urlCopied ? "var(--accent-green)" : "var(--text-primary)",
          }}
        >
          {urlCopied ? "Copied!" : "Copy URL"}
        </button>
      </div>

      <div
        className="flex items-center gap-2 p-3 rounded-md text-sm"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-secondary)",
        }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ backgroundColor: "var(--accent-blue)" }}
        />
        Waiting for authorization…
      </div>
    </div>
  );
}
