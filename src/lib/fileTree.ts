export interface FileTreeLeaf {
  status: string;
  additions: number;
  deletions: number;
}

export interface FileTreeNode {
  /** 表示名。単一子ディレクトリの連鎖は "a/b/c" に圧縮される */
  name: string;
  /** ルートからのフルパス */
  path: string;
  children: FileTreeNode[];
  file?: FileTreeLeaf;
}

interface FileEntry {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

interface MutableNode {
  name: string;
  path: string;
  dirs: Map<string, MutableNode>;
  files: FileTreeNode[];
}

function newNode(name: string, path: string): MutableNode {
  return { name, path, dirs: new Map(), files: [] };
}

function finalize(node: MutableNode): FileTreeNode[] {
  const dirs: FileTreeNode[] = Array.from(node.dirs.values())
    .map((dir) => {
      let current = dir;
      // 単一子ディレクトリの連鎖を1ノードへ圧縮する
      while (current.dirs.size === 1 && current.files.length === 0) {
        const [child] = current.dirs.values();
        current = { ...child, name: `${current.name}/${child.name}` };
      }
      return {
        name: current.name,
        path: current.path,
        children: finalize(current),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

/** 変更ファイル一覧からディレクトリツリーを構築する。 */
export function buildFileTree(files: FileEntry[]): FileTreeNode[] {
  const root = newNode("", "");
  for (const file of files) {
    const parts = file.filename.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      let dir = node.dirs.get(part);
      if (!dir) {
        dir = newNode(part, path);
        node.dirs.set(part, dir);
      }
      node = dir;
    }
    node.files.push({
      name: parts[parts.length - 1],
      path: file.filename,
      children: [],
      file: {
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      },
    });
  }
  return finalize(root);
}

/**
 * ファイル名または diff 本文に query を含むファイルだけを返す（大文字小文字無視）。
 * 空クエリは全件を返す。
 */
export function filterFilesByQuery<T extends { filename: string; patch: string | null }>(
  files: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  return files.filter(
    (file) =>
      file.filename.toLowerCase().includes(q) || (file.patch ?? "").toLowerCase().includes(q),
  );
}
