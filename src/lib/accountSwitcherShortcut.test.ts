import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SWITCH_DIGIT_MAX,
  accountIndexFromDigitKey,
  accountSwitchShortcutLabel,
  resolveAccountSwitchTarget,
} from "./accountSwitcherShortcut";

describe("accountSwitcherShortcut", () => {
  it("maps digits 1–4 to 0-based indexes", () => {
    expect(accountIndexFromDigitKey("1")).toBe(0);
    expect(accountIndexFromDigitKey("2")).toBe(1);
    expect(accountIndexFromDigitKey("3")).toBe(2);
    expect(accountIndexFromDigitKey("4")).toBe(3);
  });

  it("rejects keys outside the ⌘1–4 range", () => {
    expect(accountIndexFromDigitKey("0")).toBeNull();
    expect(accountIndexFromDigitKey("5")).toBeNull();
    expect(accountIndexFromDigitKey("a")).toBeNull();
    expect(accountIndexFromDigitKey("")).toBeNull();
    expect(accountIndexFromDigitKey("11")).toBeNull();
  });

  it("resolves account at shortcut index within the first four slots", () => {
    const accounts = ["a", "b", "c", "d", "e"];
    expect(resolveAccountSwitchTarget(accounts, 0)).toBe("a");
    expect(resolveAccountSwitchTarget(accounts, 3)).toBe("d");
    expect(resolveAccountSwitchTarget(accounts, 4)).toBeUndefined();
    expect(resolveAccountSwitchTarget(accounts, -1)).toBeUndefined();
    expect(resolveAccountSwitchTarget(["only"], 1)).toBeUndefined();
  });

  it("labels shortcuts as ⌘1–⌘4", () => {
    expect(accountSwitchShortcutLabel(0)).toBe("⌘1");
    expect(accountSwitchShortcutLabel(ACCOUNT_SWITCH_DIGIT_MAX - 1)).toBe("⌘4");
    expect(accountSwitchShortcutLabel(ACCOUNT_SWITCH_DIGIT_MAX)).toBeNull();
  });
});
