import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsShortcut } from "../../hooks/useSettingsShortcut";
import {
  useSettingsStore,
  type ShortcutId,
  type ShortcutSetting,
} from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";

const ROUTE_CHIPS: Record<string, ShortcutId[]> = {
  "/inbox": ["listUp", "listDown", "openDetail", "markRead", "markAllRead", "snooze", "snoozeLast"],
  "/review-queue": ["openDetail", "commandPalette", "nextQueue"],
  "/pulls": ["listUp", "listDown", "openDetail", "commandPalette", "listSearch"],
  "/issues": ["listUp", "listDown", "openDetail", "commandPalette", "listSearch"],
  "/activity": ["markAllRead", "commandPalette", "listSearch"],
  "/settings": ["shortcutHelp", "commandPalette"],
};

function chipsForPath(
  pathname: string,
  shortcuts: Record<ShortcutId, ShortcutSetting>,
): Array<{ id: string; label: string; keys: string }> {
  const base = pathname.startsWith("/pulls/")
    ? ROUTE_CHIPS["/pulls"]
    : pathname.startsWith("/issues/")
      ? ROUTE_CHIPS["/issues"]
      : (ROUTE_CHIPS[pathname] ?? ["commandPalette", "shortcutHelp"]);

  return base.map((id) => ({
    id,
    label: shortcuts[id]?.label ?? id,
    keys: shortcuts[id]?.keys ?? "",
  }));
}

export function ShortcutChips() {
  const enabled = useSettingsStore((s) => s.shortcutChipsEnabled);
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const workspaceSwitcherOpen = useUiStore((s) => s.workspaceSwitcherOpen);
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  useSettingsShortcut("shortcutHelp", () => setHelpOpen((open) => !open));

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const chips = useMemo(
    () => chipsForPath(location.pathname, shortcuts),
    [location.pathname, shortcuts],
  );

  const hideChrome = commandPaletteOpen || workspaceSwitcherOpen;

  return (
    <>
      {enabled && !hideChrome && (
        <div
          aria-label="Context shortcuts"
          className="pointer-events-none fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-2 rounded-lg border px-3 py-1.5 text-[11px]"
          style={{
            backgroundColor: "rgba(23, 23, 25, 0.92)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          {chips.map((chip) => (
            <span key={chip.id} className="inline-flex items-center gap-1 whitespace-nowrap">
              <kbd
                className="rounded px-1 py-0.5 font-mono"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              >
                {chip.keys}
              </kbd>
              {chip.label}
            </span>
          ))}
        </div>
      )}
      {helpOpen && !hideChrome && (
        <div
          role="dialog"
          aria-label="Shortcut help"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-lg border p-4"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-default)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Shortcuts
            </h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(shortcuts).map(([id, setting]) => (
                <li key={id} className="flex items-center justify-between gap-4">
                  <span style={{ color: "var(--text-secondary)" }}>{setting.label}</span>
                  <kbd
                    className="rounded px-1.5 py-0.5 font-mono text-xs"
                    style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                  >
                    {setting.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
