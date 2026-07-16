import type { IssueFilter } from "../features/issues/issueFilter";
import type { PullFilter, PullTab } from "../features/pulls/usePullsQuery";

export interface SavedFilter {
  id: string;
  name: string;
  target: "pulls" | "issues";
  /** URLSearchParams 形式のクエリ文字列（先頭の ? なし） */
  query: string;
}

const PULL_TABS: PullTab[] = ["created", "assigned", "review", "mentioned", "all"];

export function pullFilterToQuery(filter: PullFilter): string {
  const params = new URLSearchParams();
  if (filter.tab && filter.tab !== "all") params.set("tab", filter.tab);
  if (filter.state === "closed") params.set("state", "closed");
  if (filter.repoFullName) params.set("repo", filter.repoFullName);
  if (filter.authorLogin) params.set("author", filter.authorLogin);
  if (filter.labels && filter.labels.length > 0) params.set("labels", filter.labels.join(","));
  return params.toString();
}

export function queryToPullFilter(query: string | URLSearchParams): PullFilter {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  const tabParam = params.get("tab");
  const tab: PullTab = PULL_TABS.includes(tabParam as PullTab) ? (tabParam as PullTab) : "all";
  const filter: PullFilter = {
    tab,
    state: params.get("state") === "closed" ? "closed" : "open",
  };
  const repo = params.get("repo");
  if (repo) filter.repoFullName = repo;
  const author = params.get("author");
  if (author) filter.authorLogin = author;
  const labels = params.get("labels");
  if (labels) filter.labels = labels.split(",").filter(Boolean);
  return filter;
}

export function issueFilterToQuery(filter: IssueFilter): string {
  const params = new URLSearchParams();
  if (filter.state) params.set("state", filter.state);
  if (filter.repoFullName) params.set("repo", filter.repoFullName);
  if (filter.assigneeLogin) params.set("assignee", filter.assigneeLogin);
  if (filter.milestoneTitle) params.set("milestone", filter.milestoneTitle);
  if (filter.labels.length > 0) params.set("labels", filter.labels.join(","));
  return params.toString();
}

export function queryToIssueFilter(query: string | URLSearchParams): IssueFilter {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  const state = params.get("state");
  const filter: IssueFilter = {
    labels: (params.get("labels") ?? "").split(",").filter(Boolean),
  };
  if (state === "open" || state === "closed") filter.state = state;
  const repo = params.get("repo");
  if (repo) filter.repoFullName = repo;
  const assignee = params.get("assignee");
  if (assignee) filter.assigneeLogin = assignee;
  const milestone = params.get("milestone");
  if (milestone) filter.milestoneTitle = milestone;
  return filter;
}
