import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChecksTab } from "./ChecksTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const invokeMock = vi.mocked(invoke);

describe("ChecksTab failure excerpt", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("loads and shows failure excerpt for a failed check", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "cmd_list_pull_checks") {
        return [
          {
            id: 99,
            name: "build",
            status: "completed",
            conclusion: "failure",
            startedAt: null,
            completedAt: null,
            htmlUrl: "https://example.com/check/99",
          },
        ];
      }
      if (cmd === "cmd_get_check_failure_excerpt") {
        return {
          checkRunId: 99,
          name: "build",
          htmlUrl: "https://example.com/check/99",
          title: "Tests failed",
          summary: "AssertionError",
          textExcerpt: "Error: expected true",
          truncated: false,
          annotations: [{ path: "src/a.ts", startLine: 10, level: "failure", message: "boom" }],
          note: null,
        };
      }
      throw new Error(`unexpected ${cmd}`);
    });

    render(<ChecksTab owner="acme" repo="app" number={1} />);

    expect(await screen.findByText("build")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show excerpt" }));

    await waitFor(() => {
      expect(screen.getByText("Tests failed")).toBeInTheDocument();
    });
    expect(screen.getByText(/src\/a\.ts:10/)).toBeInTheDocument();
    expect(screen.getByText(/Error: expected true/)).toBeInTheDocument();
    expect(screen.getByText("Open full logs on GitHub")).toBeInTheDocument();
  });
});
