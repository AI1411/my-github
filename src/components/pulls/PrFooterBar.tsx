import { Button } from "../common/Button";

export interface PrFooterBarProps {
  canMerge: boolean;
  canApprove: boolean;
  htmlUrl: string;
  onOpenInEditor?: () => void;
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

export function PrFooterBar({ canMerge, canApprove, htmlUrl, onOpenInEditor }: PrFooterBarProps) {
  return (
    <footer
      className="flex items-center justify-end gap-2 px-4 py-3 border-t"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
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
