import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useDataStore } from "../stores/dataStore";
import ReleasesPage from "./ReleasesPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const sampleRelease = {
  id: 42,
  repo: "octocat/hello",
  tagName: "v1.2.0",
  name: "Spring release",
  prerelease: false,
  publishedAt: new Date().toISOString(),
  htmlUrl: "https://github.com/octocat/hello/releases/tag/v1.2.0",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
}

describe("ReleasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataStore.setState({ releases: [] });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([sampleRelease]);
  });

  it("lists releases with title, tag, and date", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Spring release")).toBeInTheDocument();
    });
    expect(screen.getByText(/v1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/octocat\/hello/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("cmd_list_releases");
  });

  it("shows empty state when there are no releases", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No releases")).toBeInTheDocument();
    });
  });
});
