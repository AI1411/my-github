import { describe, expect, it } from "vitest";
import { createWorkMode, normalizeWorkModes } from "./workModes";

describe("workModes", () => {
  it("creates a mode with defaults", () => {
    const mode = createWorkMode({
      name: " Work ",
      homePath: "/pulls",
      watchedRepositories: ["a/b"],
      notificationRules: [],
      savedFilterIds: ["f1"],
    });
    expect(mode.name).toBe("Work");
    expect(mode.homePath).toBe("/pulls");
    expect(mode.watchedRepositories).toEqual(["a/b"]);
  });

  it("normalizes persisted payloads", () => {
    const modes = normalizeWorkModes([
      { name: "Personal", homePath: "/inbox", watchedRepositories: ["me/app"] },
      { name: "" },
      null,
    ]);
    expect(modes).toHaveLength(1);
    expect(modes[0].name).toBe("Personal");
    expect(modes[0].watchedRepositories).toEqual(["me/app"]);
  });
});
