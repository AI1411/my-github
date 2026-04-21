import { create } from "zustand";
import type { IssueFilter } from "../features/issues/issueFilter";

export interface UiState {
  selectedItemId: string | null;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  workspaceSwitcherOpen: boolean;
  issueFilters: IssueFilter;
  setSelectedItemId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openWorkspaceSwitcher: () => void;
  closeWorkspaceSwitcher: () => void;
  setIssueFilters: (filter: IssueFilter) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedItemId: null,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  workspaceSwitcherOpen: false,
  issueFilters: { labels: [] },
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  openWorkspaceSwitcher: () => set({ workspaceSwitcherOpen: true }),
  closeWorkspaceSwitcher: () => set({ workspaceSwitcherOpen: false }),
  setIssueFilters: (filter) => set({ issueFilters: filter }),
}));
