export interface IssueFilter {
  state?: "open" | "closed";
  repoFullName?: string;
  assigneeLogin?: string;
  milestoneTitle?: string;
  labels: string[];
}

export function toggleLabel(filter: IssueFilter, label: string): IssueFilter {
  const has = filter.labels.includes(label);
  return {
    ...filter,
    labels: has
      ? filter.labels.filter((l) => l !== label)
      : [...filter.labels, label],
  };
}

export function withState(
  filter: IssueFilter,
  state: IssueFilter["state"],
): IssueFilter {
  return { ...filter, state };
}

export function clearFilter(_filter: IssueFilter): IssueFilter {
  return { labels: [] };
}

export function isFilterEmpty(filter: IssueFilter): boolean {
  return (
    filter.labels.length === 0 &&
    !filter.state &&
    !filter.repoFullName &&
    !filter.assigneeLogin &&
    !filter.milestoneTitle
  );
}
