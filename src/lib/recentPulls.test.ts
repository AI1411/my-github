import { describe, expect, it } from "vitest";
import { pushRecent, RECENT_PULLS_MAX, type RecentPullRef } from "./recentPulls";

function entry(
  overrides: Partial<RecentPullRef> & Pick<RecentPullRef, "repo" | "number">,
): RecentPullRef {
  return {
    title: overrides.title ?? `${overrides.repo}#${overrides.number}`,
    openedAt: overrides.openedAt ?? "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("pushRecent", () => {
  it("prepends a new entry", () => {
    const next = pushRecent([], entry({ repo: "o/r", number: 1, title: "First" }));
    expect(next).toEqual([
      {
        repo: "o/r",
        number: 1,
        title: "First",
        openedAt: "2026-08-15T00:00:00.000Z",
      },
    ]);
  });

  it("moves an existing repo+number to the front and updates title/openedAt", () => {
    const list = [
      entry({ repo: "o/r", number: 1, title: "Old", openedAt: "2026-01-01T00:00:00.000Z" }),
      entry({ repo: "o/r", number: 2, title: "Other" }),
    ];
    const next = pushRecent(
      list,
      entry({
        repo: "o/r",
        number: 1,
        title: "Updated",
        openedAt: "2026-08-15T12:00:00.000Z",
      }),
    );
    expect(next).toEqual([
      {
        repo: "o/r",
        number: 1,
        title: "Updated",
        openedAt: "2026-08-15T12:00:00.000Z",
      },
      entry({ repo: "o/r", number: 2, title: "Other" }),
    ]);
  });

  it("caps the list at RECENT_PULLS_MAX", () => {
    let list: RecentPullRef[] = [];
    for (let i = 0; i < RECENT_PULLS_MAX + 5; i++) {
      list = pushRecent(list, entry({ repo: "o/r", number: i, title: `PR ${i}` }));
    }
    expect(list).toHaveLength(RECENT_PULLS_MAX);
    expect(list[0].number).toBe(RECENT_PULLS_MAX + 4);
    expect(list[RECENT_PULLS_MAX - 1].number).toBe(5);
  });

  it("respects a custom max", () => {
    const list = pushRecent(
      [entry({ repo: "o/r", number: 1 }), entry({ repo: "o/r", number: 2 })],
      entry({ repo: "o/r", number: 3 }),
      2,
    );
    expect(list).toEqual([entry({ repo: "o/r", number: 3 }), entry({ repo: "o/r", number: 1 })]);
  });

  it("ignores invalid entries", () => {
    const list = [entry({ repo: "o/r", number: 1 })];
    expect(pushRecent(list, entry({ repo: "", number: 2 }))).toEqual(list);
    expect(pushRecent(list, entry({ repo: "o/r", number: Number.NaN }))).toEqual(list);
  });
});
