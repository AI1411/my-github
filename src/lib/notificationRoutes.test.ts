import { describe, expect, it } from "vitest";
import { notificationKind, notificationRoute } from "./notificationRoutes";

describe("notificationRoute", () => {
  it("routes GitHub pull URLs to local pull detail pages", () => {
    expect(notificationRoute("https://github.com/AI1411/my-github/pull/189")).toBe(
      "/pulls/AI1411/my-github/189",
    );
  });

  it("routes GitHub issue URLs to local issue detail pages", () => {
    expect(notificationRoute("https://github.com/AI1411/my-github/issues/118")).toBe(
      "/issues/AI1411/my-github/118",
    );
  });

  it("returns null for unsupported URLs", () => {
    expect(notificationRoute("https://example.com/pull/1")).toBeNull();
    expect(notificationRoute(null)).toBeNull();
  });
});

describe("notificationKind", () => {
  it("classifies review requests", () => {
    expect(
      notificationKind({
        reason: "review_requested",
        subjectType: "PullRequest",
      }),
    ).toBe("reviewRequest");
  });

  it("classifies CI failures", () => {
    expect(
      notificationKind({
        reason: "ci_failure",
        subjectType: "CheckSuite",
      }),
    ).toBe("ciFailure");
  });

  it("classifies mentions", () => {
    expect(
      notificationKind({
        reason: "mention",
        subjectType: "Issue",
      }),
    ).toBe("mention");
  });

  it("ignores unrelated notifications", () => {
    expect(
      notificationKind({
        reason: "subscribed",
        subjectType: "Issue",
      }),
    ).toBeNull();
  });
});
