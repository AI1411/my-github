import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSequencedRequest } from "./useSequencedRequest";

describe("useSequencedRequest", () => {
  it("ignores stale async results after a newer request starts", async () => {
    const { result } = renderHook(() => useSequencedRequest());
    const firstId = result.current.nextRequestId();
    const secondId = result.current.nextRequestId();

    expect(result.current.isCurrentRequest(firstId)).toBe(false);
    expect(result.current.isCurrentRequest(secondId)).toBe(true);
  });

  it("keeps the same current id until nextRequestId is called again", () => {
    const { result } = renderHook(() => useSequencedRequest());
    const id = result.current.nextRequestId();

    act(() => {
      expect(result.current.isCurrentRequest(id)).toBe(true);
    });
  });
});
