export type DiffLineKind = "hunk" | "addition" | "deletion" | "context" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
}

/**
 * Parse a unified diff patch string into an array of rows that carry
 * both the old/new line numbers and the kind of change. Hunk headers
 * reset the line cursors. Unknown lines are emitted as `meta`.
 */
export function parsePatch(patch: string | null | undefined): DiffLine[] {
  if (!patch) return [];
  const lines = patch.split("\n");
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of lines) {
    if (raw.startsWith("@@")) {
      const match = /^@@ -([0-9]+)(?:,[0-9]+)? \+([0-9]+)(?:,[0-9]+)? @@/.exec(raw);
      if (match) {
        oldLine = Number.parseInt(match[1], 10);
        newLine = Number.parseInt(match[2], 10);
      }
      out.push({ kind: "hunk", oldNumber: null, newNumber: null, content: raw });
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      out.push({
        kind: "addition",
        oldNumber: null,
        newNumber: newLine,
        content: raw.slice(1),
      });
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-") && !raw.startsWith("---")) {
      out.push({
        kind: "deletion",
        oldNumber: oldLine,
        newNumber: null,
        content: raw.slice(1),
      });
      oldLine += 1;
      continue;
    }
    if (raw.startsWith(" ")) {
      out.push({
        kind: "context",
        oldNumber: oldLine,
        newNumber: newLine,
        content: raw.slice(1),
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    out.push({ kind: "meta", oldNumber: null, newNumber: null, content: raw });
  }
  return out;
}

export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Re-arrange parsed lines into side-by-side pairs for split view. Consecutive
 * deletions/additions are zipped row-wise; leftover rows on either side
 * become half-empty pairs.
 */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "hunk" || line.kind === "meta" || line.kind === "context") {
      out.push({ left: line, right: line });
      i += 1;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].kind === "deletion") {
      dels.push(lines[i]);
      i += 1;
    }
    while (i < lines.length && lines[i].kind === "addition") {
      adds.push(lines[i]);
      i += 1;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      out.push({ left: dels[k] ?? null, right: adds[k] ?? null });
    }
  }
  return out;
}
