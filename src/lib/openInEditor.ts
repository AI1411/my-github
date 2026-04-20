import { invoke } from "@tauri-apps/api/core";

export type EditorKind = "vscode" | "cursor" | "zed" | "idea";

const EDITOR_BIN: Record<EditorKind, string> = {
  vscode: "code",
  cursor: "cursor",
  zed: "zed",
  idea: "idea",
};

/**
 * Open the given repo-relative path at a specific line inside the configured
 * editor. Falls back to `code` (VS Code) when no preference is stored.
 *
 * This relies on `shell:allow-execute` being granted for the specific binary
 * in `tauri.conf.json`. In environments without a shell grant, this function
 * rejects with the underlying error string.
 */
export async function openInEditor(
  path: string,
  line: number,
  editor: EditorKind = "vscode",
): Promise<void> {
  const bin = EDITOR_BIN[editor] ?? "code";
  await invoke("plugin:shell|execute", {
    program: bin,
    args: ["--goto", `${path}:${line}`],
  });
}

export function readStoredEditor(): EditorKind {
  if (typeof window === "undefined") return "vscode";
  const v = window.localStorage.getItem("pulse.settings.editor");
  if (v === "vscode" || v === "cursor" || v === "zed" || v === "idea") return v;
  return "vscode";
}

export function storeEditor(editor: EditorKind): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("pulse.settings.editor", editor);
}
