import { useEffect, useRef, useState } from "react";
import { Button } from "../common/Button";
import { checkoutCommand, copyToClipboard } from "../../lib/checkout";

export interface PrFooterBarProps {
  canMerge: boolean;
  canApprove: boolean;
  htmlUrl: string;
  onOpenInEditor?: () => void;
  checkout?: { number: number; headRef: string };
}

async function openBrowser(url: string) {
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } catch {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }
}

export function PrFooterBar({
  canMerge,
  canApprove,
  htmlUrl,
  onOpenInEditor,
  checkout,
}: PrFooterBarProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopyCheckout = async () => {
    if (!checkout) return;
    const ok = await copyToClipboard(checkoutCommand(checkout.number, checkout.headRef));
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer
      className="flex items-center justify-end gap-2 px-4 py-3 border-t"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {checkout && (
        <Button
          variant="ghost"
          onClick={() => void handleCopyCheckout()}
          title={checkoutCommand(checkout.number, checkout.headRef)}
        >
          {copied ? "Copied!" : "Copy checkout"}
        </Button>
      )}
      {onOpenInEditor && (
        <Button variant="ghost" onClick={onOpenInEditor}>
          Open in editor
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={!canApprove}
        onClick={() => openBrowser(`${htmlUrl}#review`)}
        title="Open on github.com to submit a review"
      >
        Request changes
      </Button>
      <Button
        variant="ghost"
        disabled={!canApprove}
        onClick={() => openBrowser(`${htmlUrl}#review`)}
        title="Open on github.com to approve"
      >
        Approve
      </Button>
      <Button
        variant="primary"
        disabled={!canMerge}
        onClick={() => openBrowser(htmlUrl)}
        title="Open on github.com to merge"
      >
        Merge
      </Button>
    </footer>
  );
}
