import { useEffect } from "react";
import { attentionTotal } from "../lib/accountAttention";
import { useAuthStore } from "../stores/authStore";
import { useAccountAttentionSummaries } from "./useAccountAttentionSummaries";

export const APP_WINDOW_TITLE = "my-github";

export function formatWindowTitle(count: number): string {
  return count > 0 ? `(${count}) ${APP_WINDOW_TITLE}` : APP_WINDOW_TITLE;
}

export function useWindowTitle(): void {
  const user = useAuthStore((state) => state.user);
  const { summaries } = useAccountAttentionSummaries(Boolean(user));
  const active =
    summaries.find((summary) => summary.isActive) ??
    summaries.find((summary) => summary.login === user?.login);
  const count = active ? attentionTotal(active) : 0;

  useEffect(() => {
    document.title = formatWindowTitle(count);
  }, [count]);
}
