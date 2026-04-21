import { create } from "zustand";
import type { IssueFilter } from "../features/issues/issueFilter";

export interface UiState {
  selectedItemId: string | null;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  issueFilters: IssueFilter;
  setSelectedItemId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setIssueFilters: (filter: IssueFilter) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedItemId: null,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  issueFilters: { labels: [] },
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setIssueFilters: (filter) => set({ issueFilters: filter }),
}));
