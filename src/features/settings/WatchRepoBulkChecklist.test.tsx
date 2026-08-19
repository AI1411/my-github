import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { WatchRepoBulkChecklist } from "./WatchRepoBulkChecklist";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("WatchRepoBulkChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads starred repositories and adds selected repos", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === "cmd_list_starred_repos") {
        return Promise.resolve(["octocat/hello", "octocat/world", "octocat/existing"]);
      }
      return Promise.resolve([]);
    });

    const onAddSelected = vi.fn();
    render(
      <WatchRepoBulkChecklist
        mode="starred"
        watchedRepositories={["octocat/existing"]}
        onAddSelected={onAddSelected}
      />,
    );

    expect(await screen.findByLabelText("octocat/hello")).toBeInTheDocument();
    expect(screen.getByLabelText("octocat/world")).toBeInTheDocument();
    expect(screen.queryByLabelText("octocat/existing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("octocat/hello"));
    fireEvent.click(screen.getByLabelText("octocat/world"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));

    expect(onAddSelected).toHaveBeenCalledWith(["octocat/hello", "octocat/world"]);
  });

  it("loads org repositories after selecting an organization", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string, args?: { org?: string }) => {
      if (cmd === "cmd_list_user_orgs") {
        return Promise.resolve(["acme", "beta"]);
      }
      if (cmd === "cmd_list_org_repos" && args?.org === "acme") {
        return Promise.resolve(["acme/alpha", "acme/beta"]);
      }
      return Promise.resolve([]);
    });

    const onAddSelected = vi.fn();
    render(
      <WatchRepoBulkChecklist
        mode="org"
        watchedRepositories={[]}
        onAddSelected={onAddSelected}
      />,
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_list_user_orgs");
    });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cmd_list_org_repos", { org: "acme" });
    });

    fireEvent.click(await screen.findByLabelText("acme/alpha"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));

    expect(onAddSelected).toHaveBeenCalledWith(["acme/alpha"]);
  });

  it("reloads org repos when organization changes", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string, args?: { org?: string }) => {
      if (cmd === "cmd_list_user_orgs") {
        return Promise.resolve(["acme", "beta"]);
      }
      if (cmd === "cmd_list_org_repos" && args?.org === "beta") {
        return Promise.resolve(["beta/one"]);
      }
      if (cmd === "cmd_list_org_repos") {
        return Promise.resolve(["acme/alpha"]);
      }
      return Promise.resolve([]);
    });

    render(
      <WatchRepoBulkChecklist mode="org" watchedRepositories={[]} onAddSelected={vi.fn()} />,
    );

    await screen.findByLabelText("acme/alpha");
    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "beta" } });
    expect(await screen.findByLabelText("beta/one")).toBeInTheDocument();
  });
});
