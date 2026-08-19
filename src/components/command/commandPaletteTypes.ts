export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  kind: "nav" | "pr" | "issue" | "search" | "next" | "saved" | "action" | "recent" | "mode";
  href?: string;
  /** When true, selecting fills the query and keeps the palette open. */
  keepOpen?: boolean;
  action?: () => void;
}

export const KIND_LABEL: Record<CommandItem["kind"], string> = {
  nav: "→",
  pr: "PR",
  issue: "ISS",
  search: "GH",
  next: "!",
  saved: "★",
  action: "+",
  recent: "R",
  mode: "M",
};
