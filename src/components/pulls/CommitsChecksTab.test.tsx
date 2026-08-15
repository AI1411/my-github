import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { CommitsTab } from "./CommitsTab";
import { ChecksTab } from "./ChecksTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("CommitsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders commit sha message author and time", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sha: "abcdef0123456789",
        message: "feat: hello",
        authorLogin: "octocat",
        authorName: "Octo",
        committedAt: "2026-08-15T00:00:00Z",
        htmlUrl: "https://github.com/o/r/commit/abcdef",
      },
    ]);
    render(<CommitsTab owner="o" repo="r" number={1} />);
    expect(await screen.findByText("feat: hello")).toBeInTheDocument();
    expect(screen.getByText("abcdef0")).toBeInTheDocument();
    expect(screen.getByText(/octocat/)).toBeInTheDocument();
  });
});

describe("ChecksTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders check conclusion and logs link for failures", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        name: "build",
        status: "completed",
        conclusion: "failure",
        startedAt: "2026-08-15T00:00:00Z",
        completedAt: "2026-08-15T00:01:30Z",
        htmlUrl: "https://github.com/o/r/runs/1",
      },
    ]);
    render(<ChecksTab owner="o" repo="r" number={1} />);
    expect(await screen.findByText("build")).toBeInTheDocument();
    expect(screen.getByText(/failure/)).toBeInTheDocument();
    expect(screen.getByText("View logs")).toHaveAttribute("href", "https://github.com/o/r/runs/1");
  });
});
