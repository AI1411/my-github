import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { parsePatch, toSplitRows, type DiffLine } from "./diff/parseDiff";
import { DiffLineRow } from "./diff/DiffLineRow";

export type DiffViewMode = "unified" | "split";

export interface FileDiffData {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

export interface FileDiffProps {
  file: FileDiffData;
  mode?: DiffViewMode;
  viewed?: boolean;
  onToggleViewed?: (viewed: boolean) => void;
  defaultOpen?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  added: "var(--accent-green)",
  modified: "var(--accent-yellow)",
  removed: "var(--accent-red)",
  renamed: "var(--accent-blue)",
};

function StatusIcon({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--text-muted)";
  const initial = status.charAt(0).toUpperCase();
  const style: CSSProperties = {
    color,
    borderColor: color,
    width: 18,
    height: 18,
    fontSize: 10,
    lineHeight: 1,
    fontWeight: 700,
  };
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm border"
      style={style}
      title={status}
      aria-label={status}
    >
      {initial}
    </span>
  );
}

export function FileDiff({
  file,
  mode = "unified",
  viewed = false,
  onToggleViewed,
  defaultOpen = true,
}: FileDiffProps) {
  const [open, setOpen] = useState(defaultOpen);
  const lines: DiffLine[] = useMemo(() => parsePatch(file.patch), [file.patch]);
  const splitRows = useMemo(() => toSplitRows(lines), [lines]);

  return (
    <section
      className="mx-4 my-3 rounded-md border overflow-hidden"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
        opacity: viewed ? 0.6 : 1,
      }}
    >
      <header
        className="flex items-center gap-3 px-3 py-2 border-b cursor-pointer select-none"
        style={{ borderColor: "var(--border-subtle)" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ width: 14, textAlign: "center" }}>
          {open ? "▼" : "▶"}
        </span>
        <StatusIcon status={file.status} />
        <span
          className="font-mono text-xs flex-1 truncate"
          style={{ color: "var(--text-primary)" }}
          title={file.filename}
        >
          {file.filename}
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--accent-green)" }}
        >
          +{file.additions}
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--accent-red)" }}
        >
          -{file.deletions}
        </span>
        <label
          className="flex items-center gap-1 text-[11px]"
          style={{ color: "var(--text-secondary)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={viewed}
            onChange={(e) => onToggleViewed?.(e.target.checked)}
          />
          Viewed
        </label>
      </header>
      {open && (
        <div className="overflow-x-auto">
          {mode === "unified"
            ? lines.map((l, i) => (
                <DiffLineRow key={i} line={l} showOld showNew />
              ))
            : splitRows.map((row, i) => (
                <div key={i} className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div
                    style={{
                      borderRight: "1px solid var(--border-subtle)",
                    }}
                  >
                    {row.left ? (
                      <DiffLineRow line={row.left} showOld showNew={false} />
                    ) : (
                      <div className="font-mono text-xs leading-5">&nbsp;</div>
                    )}
                  </div>
                  <div>
                    {row.right ? (
                      <DiffLineRow line={row.right} showOld={false} showNew />
                    ) : (
                      <div className="font-mono text-xs leading-5">&nbsp;</div>
                    )}
                  </div>
                </div>
              ))}
          {lines.length === 0 && (
            <div
              className="px-4 py-6 text-xs text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Binary file or no text diff available.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
