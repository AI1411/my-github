/**
 * チームのPRレビュー規約（.github/PULL_REQUEST_TEMPLATE.md）で使うprefix。
 * v0.1は書き込みAPIを持たないため、下書きをコピーしてブラウザで貼り付ける。
 */
export type ReviewPrefixId = "must" | "imo" | "nits" | "ask" | "fyi";

export interface ReviewPrefix {
  id: ReviewPrefixId;
  label: string;
  description: string;
}

export const REVIEW_PREFIXES: ReviewPrefix[] = [
  { id: "must", label: "[must]", description: "必須対応" },
  { id: "imo", label: "[imo]", description: "提案・意見" },
  { id: "nits", label: "[nits]", description: "軽微な指摘" },
  { id: "ask", label: "[ask]", description: "質問" },
  { id: "fyi", label: "[fyi]", description: "情報共有のみ" },
];

export function formatReviewComment(prefixId: ReviewPrefixId, body: string): string {
  const prefix = REVIEW_PREFIXES.find((p) => p.id === prefixId)?.label ?? `[${prefixId}]`;
  const trimmed = body.trim();
  return trimmed ? `${prefix} ${trimmed}` : prefix;
}
