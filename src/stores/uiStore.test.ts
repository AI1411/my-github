import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore.issueFilters", () => {
  beforeEach(() => {
    useUiStore.setState({ issueFilters: { labels: [] } });
  });

  it("default issueFilters has empty labels array", () => {
    expect(useUiStore.getState().issueFilters).toEqual({ labels: [] });
  });

  it("setIssueFilters replaces filter object", () => {
    useUiStore.getState().setIssueFilters({ labels: ["bug"], state: "open" });
    expect(useUiStore.getState().issueFilters).toEqual({
      labels: ["bug"],
      state: "open",
    });
  });
});
