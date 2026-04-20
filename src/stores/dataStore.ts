import { create } from "zustand";

export interface PullSummary {
  id: number;
  number: number;
  title: string;
  repo: string;
  author: string;
  state: "open" | "closed" | "merged" | "draft";
  updated_at: string;
}

export interface IssueSummary {
  id: number;
  number: number;
  title: string;
  repo: string;
  author: string;
  state: "open" | "closed";
  updated_at: string;
}

export interface NotificationSummary {
  id: string;
  reason: string;
  repo: string;
  subject_title: string;
  unread: boolean;
  updated_at: string;
}

export interface DataState {
  pulls: PullSummary[];
  issues: IssueSummary[];
  notifications: NotificationSummary[];
  lastSyncedAt: string | null;
  setPulls: (pulls: PullSummary[]) => void;
  setIssues: (issues: IssueSummary[]) => void;
  setNotifications: (notifications: NotificationSummary[]) => void;
  markLastSynced: () => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  pulls: [],
  issues: [],
  notifications: [],
  lastSyncedAt: null,
  setPulls: (pulls) => set({ pulls }),
  setIssues: (issues) => set({ issues }),
  setNotifications: (notifications) => set({ notifications }),
  markLastSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
  reset: () =>
    set({ pulls: [], issues: [], notifications: [], lastSyncedAt: null }),
}));
