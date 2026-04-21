import type { ReactNode } from "react";
import { useUiStore } from "../../stores/uiStore";
import { CommandPalette } from "../command/CommandPalette";

export interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  secondary?: ReactNode;
}

export function AppShell({ sidebar, main, secondary }: AppShellProps) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  const gridCols = sidebarCollapsed
    ? secondary
      ? "0px 1fr 1fr"
      : "0px 1fr"
    : secondary
      ? "220px 1fr 1fr"
      : "220px 1fr";

  return (
    <>
      <div
        className="min-h-screen h-screen w-screen grid overflow-hidden"
        style={{
          gridTemplateColumns: gridCols,
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
        }}
      >
        <aside
          className="h-full overflow-y-auto border-r"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary)",
            visibility: sidebarCollapsed ? "hidden" : "visible",
          }}
        >
          {sidebar}
        </aside>
        <main className="h-full overflow-y-auto">{main}</main>
        {secondary && (
          <aside
            className="h-full overflow-y-auto border-l"
            style={{ borderColor: "var(--border-default)" }}
          >
            {secondary}
          </aside>
        )}
      </div>
      <CommandPalette />
    </>
  );
}
