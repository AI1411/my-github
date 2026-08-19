import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PullDetailPage from "./PullDetailPage";
import { useDataStore } from "../stores/dataStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((name: string) => {
    if (name === "cmd_get_pull_files") return Promise.resolve([]);
    if (name === "cmd_get_merge_readiness") {
      return Promise.resolve({ mergeable: true, mergeableState: "clean", reason: null });
    }
    if (name === "cmd_get_review_context") {
      return Promise.resolve({ reviews: [], reviewComments: [] });
    }
    if (name === "cmd_list_pull_review_comments") return Promise.resolve([]);
    return Promise.resolve(null);
  }),
}));

const cachedPull = {
  id: 5,
  number: 5,
  title: "Add feature",
  repo: "octocat/hello",
  author: "octocat",
  state: "open",
  isDraft: false,
  headRef: "feature",
  baseRef: "main",
  updatedAt: "2026-04-21T00:00:00Z",
  htmlUrl: "https://github.com/octocat/hello/pull/5",
  ciState: null,
  reviewState: null,
  hasMention: false,
  requestedReviewers: [],
  mergedAt: null,
  additions: 10,
  deletions: 2,
  changedFiles: 1,
  labels: [],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pulls/:owner/:repo/:number" element={<PullDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PullDetailPage", () => {
  beforeEach(() => {
    useDataStore.setState({ pulls: [cachedPull] });
  });

  it("renders breadcrumb with owner/repo and number", async () => {
    renderAt("/pulls/octocat/hello/5");
    expect(await screen.findByText("Pull Requests")).toBeInTheDocument();
    expect(await screen.findByText("octocat/hello")).toBeInTheDocument();
    expect((await screen.findAllByText("#5")).length).toBeGreaterThan(0);
  });

  it("renders the pull title from cache", async () => {
    renderAt("/pulls/octocat/hello/5");
    expect(await screen.findByText("Add feature")).toBeInTheDocument();
  });

  it("renders detail tabs", async () => {
    renderAt("/pulls/octocat/hello/5");
    expect(await screen.findByRole("tab", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Commits" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Checks" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Files changed" })).toBeInTheDocument();
  });

  it("renders an Open status pill", async () => {
    renderAt("/pulls/octocat/hello/5");
    expect(await screen.findByText("Open")).toBeInTheDocument();
  });
});
