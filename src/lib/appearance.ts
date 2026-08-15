export type AppearanceTheme = "dark" | "light" | "system";
export type AppearanceLayout = "inbox-first" | "pulls-first";

export function resolveTheme(
  theme: AppearanceTheme,
  prefersDark: boolean = true,
): "dark" | "light" {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

export function homePathForLayout(layout: AppearanceLayout): string {
  return layout === "pulls-first" ? "/pulls" : "/inbox";
}

/** Apply theme/density/layout attributes on documentElement. */
export function applyAppearanceToDocument(opts: {
  theme: AppearanceTheme;
  density: "compact" | "comfortable";
  layout: AppearanceLayout;
  prefersDark?: boolean;
}): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(opts.theme, opts.prefersDark ?? true);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.density = opts.density;
  document.documentElement.dataset.layout = opts.layout;
}
