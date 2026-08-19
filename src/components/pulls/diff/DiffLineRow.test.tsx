import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffLineRow } from "./DiffLineRow";
import type { DiffLine } from "./parseDiff";

const additionLine: DiffLine = {
  kind: "addition",
  oldNumber: null,
  newNumber: 12,
  content: "const x = 1;",
};

const deletionLine: DiffLine = {
  kind: "deletion",
  oldNumber: 8,
  newNumber: null,
  content: "const x = 0;",
};

const contextLine: DiffLine = {
  kind: "context",
  oldNumber: 5,
  newNumber: 5,
  content: "function foo() {",
};

const hunkLine: DiffLine = {
  kind: "hunk",
  oldNumber: null,
  newNumber: null,
  content: "@@ -1,3 +1,3 @@",
};

const metaLine: DiffLine = {
  kind: "meta",
  oldNumber: null,
  newNumber: null,
  content: "\\ No newline at end of file",
};

describe("DiffLineRow", () => {
  it("calls onCommentLine with RIGHT + newNumber when clicking the new-line gutter of an addition", () => {
    const onCommentLine = vi.fn();
    render(<DiffLineRow line={additionLine} onCommentLine={onCommentLine} />);
    screen.getByRole("button", { name: "Add comment on right line 12" }).click();
    expect(onCommentLine).toHaveBeenCalledWith({ line: 12, side: "RIGHT" });
  });

  it("calls onCommentLine with LEFT + oldNumber when clicking the old-line gutter of a deletion", () => {
    const onCommentLine = vi.fn();
    render(<DiffLineRow line={deletionLine} onCommentLine={onCommentLine} />);
    screen.getByRole("button", { name: "Add comment on left line 8" }).click();
    expect(onCommentLine).toHaveBeenCalledWith({ line: 8, side: "LEFT" });
  });

  it("allows commenting on either side of a context line", () => {
    const onCommentLine = vi.fn();
    render(<DiffLineRow line={contextLine} onCommentLine={onCommentLine} />);
    screen.getByRole("button", { name: "Add comment on right line 5" }).click();
    expect(onCommentLine).toHaveBeenLastCalledWith({ line: 5, side: "RIGHT" });
    screen.getByRole("button", { name: "Add comment on left line 5" }).click();
    expect(onCommentLine).toHaveBeenLastCalledWith({ line: 5, side: "LEFT" });
  });

  it("does not fire on the empty gutter of an addition or deletion line", () => {
    const onCommentLine = vi.fn();
    render(<DiffLineRow line={additionLine} onCommentLine={onCommentLine} />);
    const gutters = screen.getAllByRole("button");
    const oldGutter = gutters.find((btn) => btn.textContent === "");
    expect(oldGutter).toBeDisabled();
  });

  it("ignores hunk and meta lines entirely", () => {
    const onCommentLine = vi.fn();
    render(
      <>
        <DiffLineRow line={hunkLine} onCommentLine={onCommentLine} />
        <DiffLineRow line={metaLine} onCommentLine={onCommentLine} />
      </>,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("does not render clickable gutters when onCommentLine is not provided", () => {
    render(<DiffLineRow line={additionLine} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
