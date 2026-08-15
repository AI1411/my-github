import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { saveInboxQueue } from "../lib/inboxQueue";
import { useInboxQueueAdvance } from "./useInboxQueueAdvance";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function Probe() {
  useInboxQueueAdvance();
  const location = useLocation();
  return <div data-testid="path">{`${location.pathname}${location.search}`}</div>;
}

describe("useInboxQueueAdvance", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("does nothing with X when the page was not opened from Inbox", () => {
    render(
      <MemoryRouter initialEntries={["/pulls/octocat/hello/5"]}>
        <Routes>
          <Route path="/pulls/:owner/:repo/:number" element={<Probe />} />
          <Route path="/inbox" element={<div>inbox</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "x" });
    expect(screen.getByTestId("path")).toHaveTextContent("/pulls/octocat/hello/5");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("dismisses and opens the next Inbox item with X", async () => {
    saveInboxQueue(
      [
        { id: "pr-1", path: "/pulls/octocat/hello/5" },
        { id: "issue-1", path: "/issues/octocat/hello/9" },
      ],
      "pr-1",
    );
    render(
      <MemoryRouter initialEntries={["/pulls/octocat/hello/5?from=inbox"]}>
        <Routes>
          <Route path="/pulls/:owner/:repo/:number" element={<Probe />} />
          <Route path="/issues/:owner/:repo/:number" element={<Probe />} />
          <Route path="/inbox" element={<div data-testid="inbox">inbox</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "x" });
    expect(invoke).toHaveBeenCalledWith("cmd_dismiss_inbox_item", { itemId: "pr-1" });
    expect(await screen.findByTestId("path")).toHaveTextContent(
      "/issues/octocat/hello/9?from=inbox",
    );
  });

  it("returns to Inbox with X on the last queued item", async () => {
    saveInboxQueue([{ id: "pr-1", path: "/pulls/octocat/hello/5" }], "pr-1");
    render(
      <MemoryRouter initialEntries={["/pulls/octocat/hello/5?from=inbox"]}>
        <Routes>
          <Route path="/pulls/:owner/:repo/:number" element={<Probe />} />
          <Route path="/inbox" element={<div data-testid="inbox">inbox</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "x" });
    expect(await screen.findByTestId("inbox")).toBeInTheDocument();
  });
});
