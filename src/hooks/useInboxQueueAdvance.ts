import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { advanceInboxQueue, loadInboxQueue } from "../lib/inboxQueue";
import { useSettingsShortcut } from "./useSettingsShortcut";

function dismissId(id: string): string | null {
  if (id.startsWith("stale-own-")) return null;
  if (id.startsWith("stale-")) return id.slice("stale-".length);
  return id;
}

/** When the detail page was opened from Inbox (`?from=inbox`), X goes to the next queued item. */
export function useInboxQueueAdvance(): void {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromInbox = params.get("from") === "inbox";

  useSettingsShortcut("markRead", () => {
    if (!fromInbox) return;
    const current = loadInboxQueue();
    const currentId = current?.entries[current.index]?.id;
    if (currentId) {
      const itemId = dismissId(currentId);
      if (itemId) {
        void invoke("cmd_dismiss_inbox_item", { itemId }).catch(() => undefined);
      }
    }
    const next = advanceInboxQueue();
    if (next) navigate(`${next}?from=inbox`);
    else navigate("/inbox");
  });
}
