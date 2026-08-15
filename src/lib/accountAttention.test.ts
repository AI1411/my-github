import { describe, expect, it } from "vitest";
import { attentionTotal, type AccountAttentionSummary } from "./accountAttention";

describe("accountAttention", () => {
  it("sums review, CI, and mention counts", () => {
    const s: AccountAttentionSummary = {
      login: "a",
      avatarUrl: null,
      isActive: true,
      reviewRequests: 2,
      ciFailures: 3,
      mentions: 1,
    };
    expect(attentionTotal(s)).toBe(6);
  });
});
