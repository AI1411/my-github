import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPatCreateUrl, PATTab } from "./PATTab";

const openInBrowser = vi.fn();

vi.mock("../../lib/openInBrowser", () => ({
  openInBrowser: (...args: unknown[]) => openInBrowser(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("buildPatCreateUrl", () => {
  it("uses github.com with required scopes and description", () => {
    expect(buildPatCreateUrl("")).toBe(
      "https://github.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github",
    );
  });

  it("uses the normalized GHES web base", () => {
    expect(buildPatCreateUrl("https://github.example.com")).toBe(
      "https://github.example.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github",
    );
  });
});

describe("PATTab", () => {
  beforeEach(() => {
    openInBrowser.mockReset();
  });

  it("opens the default PAT create URL from the intro link", async () => {
    const user = userEvent.setup();
    render(<PATTab onSuccess={vi.fn()} />);

    await user.click(screen.getAllByRole("button", { name: "Create token" })[0]);

    expect(openInBrowser).toHaveBeenCalledWith(
      "https://github.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github",
    );
  });

  it("opens a GHES PAT create URL when a custom host is set", async () => {
    const user = userEvent.setup();
    render(<PATTab onSuccess={vi.fn()} />);

    await user.type(
      screen.getByLabelText("Host URL (optional)"),
      "https://github.example.com",
    );
    await user.click(screen.getAllByRole("button", { name: "Create token" })[0]);

    expect(openInBrowser).toHaveBeenCalledWith(
      "https://github.example.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github",
    );
  });

  it("shows a Create token link in the insufficient scopes error", async () => {
    const user = userEvent.setup();
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockRejectedValue(
      "Missing required scopes: repo, read:user, notifications",
    );

    render(<PATTab onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"), "ghp_test");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Insufficient scopes")).toBeInTheDocument();

    const createLinks = screen.getAllByRole("button", { name: "Create token" });
    expect(createLinks).toHaveLength(2);

    await user.click(createLinks[1]);

    expect(openInBrowser).toHaveBeenCalledWith(
      "https://github.com/settings/tokens/new?scopes=repo,read:user,notifications&description=my-github",
    );
  });
});
