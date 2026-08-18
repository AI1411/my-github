import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { usePullFilesQuery } from "./usePullFilesQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

describe("usePullFilesQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes cmd_get_pull_files with parsed args", async () => {
    mockInvoke.mockResolvedValue([]);
    renderHook(() => usePullFilesQuery("o", "r", 1));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("cmd_get_pull_files", {
        owner: "o",
        repo: "r",
        number: 1,
      });
    });
  });

  it("ignores stale responses when params change", async () => {
    let resolveFirst!: (value: unknown[]) => void;
    mockInvoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockInvoke.mockResolvedValueOnce([
      { filename: "new.ts", status: "modified", additions: 1, deletions: 0, patch: null },
    ]);

    const { result, rerender } = renderHook(
      ({ owner, repo, number }) => usePullFilesQuery(owner, repo, number),
      { initialProps: { owner: "o", repo: "r", number: 1 } },
    );

    rerender({ owner: "o", repo: "r", number: 2 });

    await waitFor(() => {
      expect(result.current.files[0]?.filename).toBe("new.ts");
    });

    resolveFirst([
      { filename: "stale.ts", status: "modified", additions: 1, deletions: 0, patch: null },
    ]);

    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.files[0]?.filename).toBe("new.ts");
  });
});
