import { create } from "zustand";

export interface ReviewerInfo {
  login: string;
  avatarUrl: string;
}

export interface PullSummary {
  id: number;
  number: number;
  title: string;
  repo: string;
  author: string | null;
  state: string;
  isDraft: boolean;
  headRef: string;
  baseRef: string;
  updatedAt: string;
  htmlUrl: string | null;
  ciState: string | null;
  reviewState: string | null;
  hasMention: boolean;
  requestedReviewers: ReviewerInfo[];
  mergedAt: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

export interface IssueLabelInfo {
  name: string;
  color: string;
}

export interface IssueAssigneeInfo {
  login: string;
  avatarUrl: string;
}

export interface IssueSummary {
  id: number;
  number: number;
  title: string;
  repo: string;
  author: string | null;
  state: string;
  labels: IssueLabelInfo[];
  assignees: IssueAssigneeInfo[];
  milestone: string | null;
  comments: number;
  updatedAt: string;
  htmlUrl: string | null;
  body: string | null;
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
