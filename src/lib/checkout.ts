/**
 * PRをローカルで確認するための git コマンドを組み立てる。
 * fork元ブランチ名に依存せず `pull/{N}/head` 参照を使うので常に取得できる。
 */
export function checkoutCommand(number: number, headRef: string): string {
  const branch = sanitizeBranchName(headRef) || `pr-${number}`;
  return `git fetch origin pull/${number}/head:${branch} && git switch ${branch}`;
}

/** ブランチ名として安全でない文字を除去する（シェル引用を避けるため） */
function sanitizeBranchName(ref: string): string {
  return ref.replace(/[^A-Za-z0-9._/-]/g, "");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
