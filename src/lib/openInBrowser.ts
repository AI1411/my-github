/** Open a GitHub URL in the system browser. Falls back to window.open outside Tauri. */
export async function openInBrowser(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
