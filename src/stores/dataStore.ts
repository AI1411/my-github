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
  labels?: string[];
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
  reactions?: {
    content: string;
    count: number;
    viewerHasReacted: boolean;
  }[];
}

export interface NotificationSummary {
  id: string;
  reason: string;
  repo: string;
  subjectTitle: string;
  subjectType: string;
  htmlUrl: string | null;
  unread: boolean;
  updatedAt: string;
}

export type InboxItemKind = "review_requested" | "ci_failure" | "mention" | "stale_review_request";

export interface InboxItem {
  id: string;
  kind: InboxItemKind | string;
  repo: string;
  number: number | null;
  title: string;
  htmlUrl: string | null;
  updatedAt: string;
  unread: boolean;
  pinned: boolean;
}

export interface InboxData {
  reviewRequests: InboxItem[];
  ciFailures: InboxItem[];
  mentions: InboxItem[];
}

export interface ReleaseSummary {
  id: number;
  repo: string;
  tagName: string;
  name: string | null;
  prerelease: boolean;
  publishedAt: string | null;
  htmlUrl: string;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  headBranch: string | null;
  runNumber: number;
  runStartedAt: string | null;
  updatedAt: string;
  htmlUrl: string;
  repo: string;
}

export interface DataState {
  pulls: PullSummary[];
  issues: IssueSummary[];
  notifications: NotificationSummary[];
  releases: ReleaseSummary[];
  lastSyncedAt: string | null;
  setPulls: (pulls: PullSummary[]) => void;
  setIssues: (issues: IssueSummary[]) => void;
  setNotifications: (notifications: NotificationSummary[]) => void;
  setReleases: (releases: ReleaseSummary[]) => void;
  patchPullReviewState: (repo: string, number: number, reviewState: string) => void;
  patchPullState: (repo: string, number: number, state: string) => void;
  patchPullDraft: (repo: string, number: number, isDraft: boolean) => void;
  patchPullReviewers: (
    repo: string,
    number: number,
    reviewers: { login: string; avatarUrl: string }[],
  ) => void;
  patchIssue: (
    repo: string,
    number: number,
    patch: Partial<Pick<IssueSummary, "state" | "labels" | "assignees">>,
  ) => void;
  markLastSynced: () => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  pulls: [],
  issues: [],
  notifications: [],
  releases: [],
  lastSyncedAt: null,
  setPulls: (pulls) => set({ pulls }),
  setIssues: (issues) => set({ issues }),
  setNotifications: (notifications) => set({ notifications }),
  setReleases: (releases) => set({ releases }),
  patchPullReviewState: (repo, number, reviewState) =>
    set((state) => ({
      pulls: state.pulls.map((p) =>
        p.repo === repo && p.number === number ? { ...p, reviewState } : p,
      ),
    })),
  patchPullState: (repo, number, nextState) =>
    set((state) => ({
      pulls: state.pulls.map((p) =>
        p.repo === repo && p.number === number
          ? {
              ...p,
              state: nextState === "merged" ? "closed" : nextState,
              mergedAt:
                nextState === "merged"
                  ? (p.mergedAt ?? new Date().toISOString())
                  : nextState === "open" || nextState === "closed"
                    ? null
                    : p.mergedAt,
            }
          : p,
      ),
    })),
  patchPullDraft: (repo, number, isDraft) =>
    set((state) => ({
      pulls: state.pulls.map((p) =>
        p.repo === repo && p.number === number ? { ...p, isDraft } : p,
      ),
    })),
  patchPullReviewers: (repo, number, reviewers) =>
    set((state) => ({
      pulls: state.pulls.map((p) =>
        p.repo === repo && p.number === number ? { ...p, requestedReviewers: reviewers } : p,
      ),
    })),
  patchIssue: (repo, number, patch) =>
    set((state) => ({
      issues: state.issues.map((i) =>
        i.repo === repo && i.number === number ? { ...i, ...patch } : i,
      ),
    })),
  markLastSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
  reset: () => set({ pulls: [], issues: [], notifications: [], releases: [], lastSyncedAt: null }),
}));
