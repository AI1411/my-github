import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import IssueDetailPage from "./IssueDetailPage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((name: string) => {
    if (name === "cmd_get_issue") {
      return Promise.resolve({
        id: 7,
        number: 7,
        title: "Fix bug",
        repo: "octocat/alpha",
        author: "octocat",
        state: "open",
        labels: [{ name: "bug", color: "d73a4a" }],
        assignees: [{ login: "alice", avatarUrl: "" }],
        milestone: "v1",
        comments: 1,
        updatedAt: "2026-04-21T00:00:00Z",
        htmlUrl: "https://github.com/octocat/alpha/issues/7",
        body: "## Steps\n- repro",
      });
    }
    if (name === "cmd_list_issue_comments") {
      return Promise.resolve([]);
    }
    return Promise.resolve(null);
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/issues/:owner/:repo/:number"
          element={<IssueDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IssueDetailPage", () => {
  it("renders breadcrumb with owner/repo and number", async () => {
    renderAt("/issues/octocat/alpha/7");
    expect(await screen.findByText("Issues")).toBeInTheDocument();
    expect(await screen.findByText("octocat/alpha")).toBeInTheDocument();
    expect((await screen.findAllByText("#7")).length).toBeGreaterThan(0);
  });

  it("renders the title once data has loaded", async () => {
    renderAt("/issues/octocat/alpha/7");
    expect(await screen.findByText("Fix bug")).toBeInTheDocument();
  });

  it("renders an Open status pill", async () => {
    renderAt("/issues/octocat/alpha/7");
    expect(await screen.findByText("Open")).toBeInTheDocument();
  });

  it("renders the IssueOriginalPost (markdown body)", async () => {
    renderAt("/issues/octocat/alpha/7");
    expect(
      await screen.findByRole("heading", { name: "Steps" }),
    ).toBeInTheDocument();
  });

  it("renders the IssueSidebar with assignee", async () => {
    renderAt("/issues/octocat/alpha/7");
    expect(await screen.findByText("Assignees")).toBeInTheDocument();
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });
});
