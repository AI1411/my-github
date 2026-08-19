import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import { useSettingsStore } from "../stores/settingsStore";

vi.mock("./components/PATTab", () => ({
  PATTab: ({
    onSuccess,
  }: {
    onSuccess: (user: { login: string; avatar_url: string }, hostWebBase: string) => void;
  }) => (
    <button
      type="button"
      data-testid="pat-tab"
      onClick={() => onSuccess({ login: "octocat", avatar_url: "" }, "https://github.example.com")}
    >
      Connect
    </button>
  ),
}));

describe("LoginPage", () => {
  it("shows the expired token message when the session expired", () => {
    render(<LoginPage expired />);
    expect(screen.getByText("Token expired. Paste a new PAT.")).toBeInTheDocument();
  });

  it("hides the expired message on a fresh login", () => {
    render(<LoginPage />);
    expect(screen.queryByText("Token expired. Paste a new PAT.")).not.toBeInTheDocument();
  });

  it("persists the GHES host into settings when login succeeds", () => {
    render(<LoginPage />);
    screen.getByRole("button", { name: "Connect" }).click();
    expect(useSettingsStore.getState().accountHosts.octocat).toBe("https://github.example.com");
  });
});
