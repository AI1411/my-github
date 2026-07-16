import { useMemo } from "react";
import { buildFileTree, type FileTreeNode } from "../../lib/fileTree";
import type { FileDiffData } from "./FileDiff";

interface FileTreePanelProps {
  files: FileDiffData[];
  onSelectFile: (filename: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  added: "var(--accent-green)",
  modified: "var(--accent-yellow, #eab308)",
  removed: "var(--accent-red)",
  renamed: "var(--accent-blue)",
};

function TreeNode({
  node,
  depth,
  onSelectFile,
}: {
  node: FileTreeNode;
  depth: number;
  onSelectFile: (filename: string) => void;
}) {
  const indent = { paddingLeft: `${depth * 12 + 8}px` };
  if (!node.file) {
    return (
      <div>
        <div
          className="py-0.5 pr-2 text-xs font-medium truncate"
          style={{ ...indent, color: "var(--text-muted)" }}
          title={node.path}
        >
          {node.name}/
        </div>
        {node.children.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
        ))}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      className="w-full py-0.5 pr-2 flex items-center gap-1.5 text-left text-xs truncate hover:underline"
      style={{ ...indent, color: "var(--text-secondary)" }}
      title={node.path}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: STATUS_COLOR[node.file.status] ?? "var(--text-muted)",
        }}
        aria-hidden
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTreePanel({ files, onSelectFile }: FileTreePanelProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  if (files.length === 0) return null;
  return (
    <nav aria-label="Changed files" className="py-2">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} depth={0} onSelectFile={onSelectFile} />
      ))}
    </nav>
  );
}
