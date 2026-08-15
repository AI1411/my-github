import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewContextPanel } from "./ReviewContextPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const invokeMock = vi.mocked(invoke);

describe("ReviewContextPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("shows CODEOWNERS owners and unmet team request", async () => {
    invokeMock.mockResolvedValue({
      requestedReviewers: [{ login: "bob", avatarUrl: "" }],
      requestedTeams: [
        { slug: "platform", name: "Platform", combinedSlug: "acme/platform" },
      ],
      changedFiles: ["src/app.ts"],
      codeownersText: "* @alice\nsrc/** @acme/frontend\n",
      codeownersPath: ".github/CODEOWNERS",
      reviews: [],
    });

    render(<ReviewContextPanel owner="acme" repo="app" number={1} reviewState="PENDING" />);

    expect(await screen.findByText(/Your state: PENDING/)).toBeInTheDocument();
    expect(screen.getAllByText("@acme/frontend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getAllByText(/acme\/platform/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Team review requested/)).toBeInTheDocument();
  });
});
