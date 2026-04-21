import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useUiStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { login: "octocat", avatar_url: "" },
      token: null,
      status: "authenticated",
    });
  });

  it("renders Accounts header when open", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("renders the current user login", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("shows Active badge for current user", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Sign out button", () => {
    useUiStore.setState({ workspaceSwitcherOpen: true });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    useUiStore.setState({ workspaceSwitcherOpen: false });
    render(<WorkspaceSwitcher />);
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
  });
});
