import { describe, expect, it } from "vitest";
import type { InboxItem } from "../stores/dataStore";
import {
  advanceInboxQueue,
  buildInboxQueue,
  inboxItemDetailPath,
  loadInboxQueue,
  saveInboxQueue,
} from "./inboxQueue";

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "pr-1",
    kind: "review_requested",
    repo: "octocat/hello",
    number: 5,
    title: "Review",
    htmlUrl: "https://github.com/octocat/hello/pull/5",
    updatedAt: "2026-04-21T00:00:00Z",
    unread: true,
    pinned: false,
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

describe("inboxItemDetailPath", () => {
  it("maps review requests to the pull detail route", () => {
    expect(inboxItemDetailPath(item())).toBe("/pulls/octocat/hello/5");
  });

  it("maps issue mentions to the issue detail route", () => {
    expect(
      inboxItemDetailPath(
        item({
          id: "issue-1",
          kind: "mention",
          number: 9,
          htmlUrl: "https://github.com/octocat/hello/issues/9",
        }),
      ),
    ).toBe("/issues/octocat/hello/9");
  });

  it("returns null when number is missing", () => {
    expect(inboxItemDetailPath(item({ number: null }))).toBeNull();
  });
});

describe("inbox queue advance", () => {
  it("returns the next path and exhausts at the end", () => {
    const storage = memoryStorage();
    const entries = buildInboxQueue([
      item(),
      item({
        id: "issue-1",
        kind: "mention",
        number: 9,
        htmlUrl: "https://github.com/octocat/hello/issues/9",
      }),
    ]);
    saveInboxQueue(entries, "pr-1", storage);
    expect(loadInboxQueue(storage)?.index).toBe(0);
    expect(advanceInboxQueue(storage)).toBe("/issues/octocat/hello/9");
    expect(advanceInboxQueue(storage)).toBeNull();
    expect(loadInboxQueue(storage)).toBeNull();
  });
});
