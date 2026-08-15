import { useState } from "react";
import {
  buildPrSummaryPrompt,
  generateLocalSummary,
  type LocalLlmSettings,
} from "../../lib/localLlm";

interface FileStat {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

interface PrLlmSummaryPanelProps {
  title: string;
  body: string | null;
  files: FileStat[];
  settings: LocalLlmSettings;
}

export function PrLlmSummaryPanel({ title, body, files, settings }: PrLlmSummaryPanelProps) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!settings.enabled) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const prompt = buildPrSummaryPrompt({ title, body, files });
      const result = await generateLocalSummary(settings, prompt);
      setText(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="mx-4 my-3 rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-secondary)",
      }}
      aria-label="Local LLM PR summary"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>
          Local LLM summary
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="rounded-md px-2.5 py-1 font-medium"
          style={{
            backgroundColor: "var(--accent-blue)",
            color: "#fff",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Generating…" : text ? "Regenerate" : "Generate"}
        </button>
      </div>
      <p className="mb-2" style={{ color: "var(--text-muted)" }}>
        Uses {settings.model} at {settings.endpoint}
        {!settings.allowRemote ? " (local only)" : ""}.
      </p>
      {error && (
        <p role="alert" style={{ color: "var(--accent-red)" }}>
          {error}
        </p>
      )}
      {text && (
        <pre
          className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          {text}
        </pre>
      )}
    </section>
  );
}
