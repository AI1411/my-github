import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileDiff } from "./FileDiff";

describe("FileDiff pending line comments", () => {
  const file = {
    sha: "abc",
    filename: "src/a.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "@@ -1,1 +1,2 @@\n context\n+added line\n",
  };

  it("starts a draft from the gutter and commits a pending comment", () => {
    const onAdd = vi.fn();
    render(<FileDiff file={file} canComment onAddPendingComment={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /Add comment on right line 2/i }));
    const textarea = screen.getByLabelText("Pending line comment");
    fireEvent.change(textarea, { target: { value: "looks good" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to review" }));

    expect(onAdd).toHaveBeenCalledWith({
      path: "src/a.ts",
      line: 2,
      side: "RIGHT",
      body: "looks good",
    });
  });
});
