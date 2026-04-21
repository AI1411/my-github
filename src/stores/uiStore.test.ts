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

describe("uiStore.workspaceSwitcher", () => {
  beforeEach(() => {
    useUiStore.setState({ workspaceSwitcherOpen: false });
  });

  it("default workspaceSwitcherOpen is false", () => {
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(false);
  });

  it("openWorkspaceSwitcher sets to true", () => {
    useUiStore.getState().openWorkspaceSwitcher();
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(true);
  });

  it("closeWorkspaceSwitcher sets to false", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    useUiStore.getState().closeWorkspaceSwitcher();
    expect(useUiStore.getState().workspaceSwitcherOpen).toBe(false);
  });
});
