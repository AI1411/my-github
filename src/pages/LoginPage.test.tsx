import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

vi.mock("./components/PATTab", () => ({
  PATTab: () => <div data-testid="pat-tab" />,
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
});
