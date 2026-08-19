import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { attentionTotal, type AccountAttentionSummary } from "../lib/accountAttention";

export function useAccountAttentionSummaries(enabled = true) {
  const [summaries, setSummaries] = useState<AccountAttentionSummary[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSummaries([]);
      return;
    }
    let cancelled = false;
    invoke<AccountAttentionSummary[]>("cmd_get_account_attention_summaries")
      .then((rows) => {
        if (!cancelled) setSummaries(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSummaries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const crossAccountTotal = (summaries ?? []).reduce((sum, s) => sum + attentionTotal(s), 0);

  return { summaries, crossAccountTotal };
}
