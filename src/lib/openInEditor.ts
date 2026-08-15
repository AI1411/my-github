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

export interface OpenPrInEditorArgs {
  localPath: string;
  headRef: string;
  editor: EditorKind;
  useWorktree: boolean;
}

export interface OpenPrInEditorResult {
  path: string;
  branch: string;
  usedWorktree: boolean;
  editor: string;
}

/** Checkout/worktree PR branch under a mapped local clone, then open editor. */
export async function openPrInEditor(args: OpenPrInEditorArgs): Promise<OpenPrInEditorResult> {
  return invoke<OpenPrInEditorResult>("cmd_open_pr_in_editor", {
    localPath: args.localPath,
    headRef: args.headRef,
    editor: args.editor,
    useWorktree: args.useWorktree,
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

export function normalizeRepoPathMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && k.includes("/") && v.trim()) {
      out[k.trim()] = v.trim();
    }
  }
  return out;
}
