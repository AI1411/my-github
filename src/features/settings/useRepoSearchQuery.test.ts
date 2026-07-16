import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useRepoSearchQuery } from "./useRepoSearchQuery";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

const sampleResults = [
  { fullName: "octocat/hello", description: "A repo", stars: 42, private: false },
  { fullName: "octocat/world", description: null, stars: 1, private: true },
];

describe("useRepoSearchQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not search when query is shorter than 2 chars", async () => {
    renderHook(() => useRepoSearchQuery("a"));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("debounces the query by 300ms", async () => {
    mockInvoke.mockResolvedValue(sampleResults);
    const { rerender } = renderHook(({ q }) => useRepoSearchQuery(q), {
      initialProps: { q: "oc" },
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ q: "oct" });
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(mockInvoke).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("cmd_search_repositories", { query: "oct" });
  });

  it("returns results after a successful search", async () => {
    mockInvoke.mockResolvedValue(sampleResults);
    const { result } = renderHook(() => useRepoSearchQuery("octo"));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.results).toHaveLength(2);
    expect(result.current.results[0].fullName).toBe("octocat/hello");
    expect(result.current.loading).toBe(false);
  });

  it("captures errors without throwing", async () => {
    mockInvoke.mockRejectedValue("rate limit exceeded");
    const { result } = renderHook(() => useRepoSearchQuery("octo"));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.error).toBe("rate limit exceeded");
    expect(result.current.loading).toBe(false);
  });

  it("ignores stale responses when the query changes", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockInvoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockInvoke.mockResolvedValueOnce([sampleResults[1]]);

    const { result, rerender } = renderHook(({ q }) => useRepoSearchQuery(q), {
      initialProps: { q: "first" },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    rerender({ q: "second" });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => {
      resolveFirst(sampleResults);
      await Promise.resolve();
    });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].fullName).toBe("octocat/world");
  });

  it("clears results when the query becomes too short", async () => {
    mockInvoke.mockResolvedValue(sampleResults);
    const { result, rerender } = renderHook(({ q }) => useRepoSearchQuery(q), {
      initialProps: { q: "octo" },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.results).toHaveLength(2);
    rerender({ q: "" });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.results).toHaveLength(0);
  });
});
