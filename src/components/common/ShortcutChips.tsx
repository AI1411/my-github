import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import {
  useSettingsStore,
  type ShortcutId,
  type ShortcutSetting,
} from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";

const ROUTE_CHIPS: Record<string, ShortcutId[]> = {
  "/inbox": ["listUp", "listDown", "openDetail", "markRead", "markAllRead"],
  "/review-queue": ["openDetail", "commandPalette"],
  "/pulls": ["listUp", "listDown", "openDetail", "commandPalette"],
  "/issues": ["listUp", "listDown", "openDetail", "commandPalette"],
  "/activity": ["markAllRead", "commandPalette"],
  "/settings": ["shortcutHelp", "commandPalette"],
};

const EXTRA_LABELS: Record<string, { label: string; keys: string }> = {
  snooze: { label: "Snooze", keys: "H" },
  snoozeLast: { label: "Snooze last", keys: "Shift+H" },
  listSearch: { label: "Find in list", keys: "Cmd+F" },
  nextQueue: { label: "Next", keys: "] / N" },
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

  const items = base.map((id) => ({
    id,
    label: shortcuts[id]?.label ?? id,
    keys: shortcuts[id]?.keys ?? "",
  }));

  if (pathname === "/inbox") {
    items.push(
      { id: "snooze", ...EXTRA_LABELS.snooze },
      { id: "snoozeLast", ...EXTRA_LABELS.snoozeLast },
    );
  }
  if (pathname === "/review-queue") {
    items.push({ id: "nextQueue", ...EXTRA_LABELS.nextQueue });
  }
  if (pathname === "/pulls" || pathname === "/issues" || pathname === "/activity") {
    items.push({ id: "listSearch", ...EXTRA_LABELS.listSearch });
  }
  return items;
}

export function ShortcutChips() {
  const enabled = useSettingsStore((s) => s.shortcutChipsEnabled);
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const workspaceSwitcherOpen = useUiStore((s) => s.workspaceSwitcherOpen);
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  useKeyboardShortcut(
    { key: "?", shift: true, preventDefault: true },
    () => setHelpOpen((open) => !open),
    {},
  );

  const chips = useMemo(
    () => chipsForPath(location.pathname, shortcuts),
    [location.pathname, shortcuts],
  );

  if (!enabled || commandPaletteOpen || workspaceSwitcherOpen) return null;

  return (
    <>
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
      {helpOpen && (
        <div
          role="dialog"
          aria-label="Shortcut help"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setHelpOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setHelpOpen(false);
          }}
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
