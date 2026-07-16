import { describe, expect, it } from "vitest";
import { buildFileTree, filterFilesByQuery } from "./fileTree";

function entry(filename: string, status = "modified") {
  return { filename, status, additions: 1, deletions: 0 };
}

describe("buildFileTree", () => {
  it("nests files under their directories", () => {
    const tree = buildFileTree([entry("src/a.ts"), entry("src/b.ts"), entry("README.md")]);
    expect(tree.map((n) => n.name)).toEqual(["src", "README.md"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["a.ts", "b.ts"]);
    expect(tree[1].file?.status).toBe("modified");
  });

  it("compresses single-child directory chains", () => {
    const tree = buildFileTree([entry("src/components/pulls/FileDiff.tsx")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("src/components/pulls");
    expect(tree[0].children[0].name).toBe("FileDiff.tsx");
    expect(tree[0].children[0].path).toBe("src/components/pulls/FileDiff.tsx");
  });

  it("keeps directories with multiple children uncompressed", () => {
    const tree = buildFileTree([entry("src/a/x.ts"), entry("src/b/y.ts")]);
    expect(tree[0].name).toBe("src");
    expect(tree[0].children.map((n) => n.name)).toEqual(["a", "b"]);
  });

  it("sorts directories before files", () => {
    const tree = buildFileTree([entry("zz.ts"), entry("aa/b.ts")]);
    expect(tree.map((n) => n.name)).toEqual(["aa", "zz.ts"]);
  });

  it("returns an empty tree for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });
});

describe("filterFilesByQuery", () => {
  const files = [
    { filename: "src/auth.rs", patch: "fn login() {}" },
    { filename: "src/db.rs", patch: "fn migrate() {}" },
    { filename: "image.png", patch: null },
  ];

  it("returns all files for an empty query", () => {
    expect(filterFilesByQuery(files, "  ")).toHaveLength(3);
  });

  it("matches by filename case-insensitively", () => {
    expect(filterFilesByQuery(files, "AUTH")).toEqual([files[0]]);
  });

  it("matches by patch content", () => {
    expect(filterFilesByQuery(files, "migrate")).toEqual([files[1]]);
  });

  it("handles files without a patch", () => {
    expect(filterFilesByQuery(files, "png")).toEqual([files[2]]);
  });
});
