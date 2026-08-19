import { beforeEach, describe, expect, it } from "vitest";
import { useDataStore, type PullSummary } from "./dataStore";

function samplePull(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 1,
    number: 1,
    title: "PR",
    repo: "o/r",
    author: "user",
    state: "open",
    isDraft: false,
    headRef: "feature",
    baseRef: "main",
    updatedAt: "2026-04-21T00:00:00Z",
    htmlUrl: null,
    ciState: null,
    reviewState: null,
    hasMention: false,
    requestedReviewers: [],
    mergedAt: null,
    additions: null,
    deletions: null,
    changedFiles: null,
    ...overrides,
  };
}

describe("dataStore.patchPullState", () => {
  beforeEach(() => {
    useDataStore.setState({ pulls: [samplePull()] });
  });

  it("sets mergedAt and closed state when nextState is merged", () => {
    useDataStore.getState().patchPullState("o/r", 1, "merged");

    const pull = useDataStore.getState().pulls[0];
    expect(pull.state).toBe("closed");
    expect(pull.mergedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("preserves existing mergedAt when nextState is merged", () => {
    useDataStore.setState({
      pulls: [samplePull({ mergedAt: "2026-05-01T00:00:00Z" })],
    });
    useDataStore.getState().patchPullState("o/r", 1, "merged");

    expect(useDataStore.getState().pulls[0].mergedAt).toBe("2026-05-01T00:00:00Z");
  });

  it("clears mergedAt when closing without merge", () => {
    useDataStore.setState({
      pulls: [samplePull({ mergedAt: "2026-05-01T00:00:00Z" })],
    });
    useDataStore.getState().patchPullState("o/r", 1, "closed");

    const pull = useDataStore.getState().pulls[0];
    expect(pull.state).toBe("closed");
    expect(pull.mergedAt).toBeNull();
  });

  it("clears mergedAt when reopening", () => {
    useDataStore.setState({
      pulls: [samplePull({ state: "closed", mergedAt: "2026-05-01T00:00:00Z" })],
    });
    useDataStore.getState().patchPullState("o/r", 1, "open");

    const pull = useDataStore.getState().pulls[0];
    expect(pull.state).toBe("open");
    expect(pull.mergedAt).toBeNull();
  });
});
