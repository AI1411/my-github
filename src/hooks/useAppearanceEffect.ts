import { useEffect } from "react";
import { applyAppearanceToDocument } from "../lib/appearance";
import { useSettingsStore } from "../stores/settingsStore";

export function useAppearanceEffect(): void {
  const theme = useSettingsStore((s) => s.theme);
  const density = useSettingsStore((s) => s.density);
  const layout = useSettingsStore((s) => s.layout);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      applyAppearanceToDocument({
        theme,
        density,
        layout,
        prefersDark: mq.matches,
      });
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, density, layout]);
}
