export interface LocalLlmSettings {
  enabled: boolean;
  /** Allow leaving localhost (user must opt in). */
  allowRemote: boolean;
  endpoint: string;
  model: string;
}

export const DEFAULT_LOCAL_LLM: LocalLlmSettings = {
  enabled: false,
  allowRemote: false,
  endpoint: "http://127.0.0.1:11434",
  model: "llama3.2",
};

export function isLocalEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function assertLlmEndpointAllowed(
  settings: Pick<LocalLlmSettings, "endpoint" | "allowRemote">,
): void {
  if (!isLocalEndpoint(settings.endpoint) && !settings.allowRemote) {
    throw new Error(
      "Remote LLM endpoints are blocked. Enable “Allow remote endpoint” in Settings.",
    );
  }
}

export interface PrSummaryInput {
  title: string;
  body: string | null;
  files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
}

export function buildPrSummaryPrompt(input: PrSummaryInput): string {
  const fileLines = input.files
    .slice(0, 40)
    .map(
      (f) =>
        `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`,
    )
    .join("\n");
  return [
    "Summarize this GitHub pull request for a reviewer.",
    "Return: (1) 2–4 sentence overview, (2) bullet list of notable file changes.",
    "",
    `Title: ${input.title}`,
    `Body: ${input.body?.trim() || "(no description)"}`,
    "Changed files:",
    fileLines || "(none listed)",
  ].join("\n");
}

export interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

/** Call a local Ollama-compatible /api/generate endpoint. */
export async function generateLocalSummary(
  settings: LocalLlmSettings,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!settings.enabled) {
    throw new Error("Local LLM is disabled in Settings.");
  }
  assertLlmEndpointAllowed(settings);
  const url = `${settings.endpoint.replace(/\/$/, "")}/api/generate`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as OllamaGenerateResponse;
  if (data.error) throw new Error(data.error);
  const out = data.response?.trim();
  if (!out) throw new Error("LLM returned an empty response.");
  return out;
}
