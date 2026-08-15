export interface AccountAttentionSummary {
  login: string;
  avatarUrl: string | null;
  isActive: boolean;
  reviewRequests: number;
  ciFailures: number;
  mentions: number;
}

export function attentionTotal(s: AccountAttentionSummary): number {
  return s.reviewRequests + s.ciFailures + s.mentions;
}
