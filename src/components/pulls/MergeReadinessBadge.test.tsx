import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MergeReadinessBadge, type MergeReadiness } from "./MergeReadinessBadge";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function readiness(overrides: Partial<MergeReadiness> = {}): MergeReadiness {
  return {
    mergeable: true,
    mergeableState: "clean",
    approvals: 1,
    changesRequested: 0,
    ciState: "success",
    isDraft: false,
    ready: true,
    blockers: [],
    ...overrides,
  };
}

describe("MergeReadinessBadge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches readiness with owner/repo/number", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(readiness());
    render(<MergeReadinessBadge owner="octocat" repo="hello" number={5} />);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_get_merge_readiness", {
        owner: "octocat",
        repo: "hello",
        number: 5,
      });
    });
  });

  it("shows Ready to merge when ready", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(readiness());
    render(<MergeReadinessBadge owner="o" repo="r" number={1} />);
    expect(await screen.findByText("Ready to merge")).toBeInTheDocument();
  });

  it("shows the first blocker and a count of the rest", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(
      readiness({
        ready: false,
        blockers: ["Merge conflicts", "CI failing", "No approvals yet"],
      }),
    );
    render(<MergeReadinessBadge owner="o" repo="r" number={1} />);
    expect(await screen.findByText("Merge conflicts")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders nothing when the fetch fails", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue("boom");
    const { container } = render(<MergeReadinessBadge owner="o" repo="r" number={1} />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
