import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "./router";

const createBrowserRouterMock = vi.fn(() => ({ id: Math.random() }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    createBrowserRouter: (...args: unknown[]) => createBrowserRouterMock(...args),
    RouterProvider: ({ router }: { router: { id: number } }) => (
      <div data-testid="router-provider" data-router-id={String(router.id)} />
    ),
  };
});

vi.mock("../components/layout/AppShell", () => ({
  AppShell: ({ main }: { main: React.ReactNode }) => <div>{main}</div>,
}));
vi.mock("../components/layout/Sidebar", () => ({
  Sidebar: () => <aside />,
}));
vi.mock("../pages/InboxPage", () => ({ default: () => null }));
vi.mock("../pages/ReviewQueuePage", () => ({ default: () => null }));
vi.mock("../pages/MyBlockersPage", () => ({ default: () => null }));
vi.mock("../pages/PullsPage", () => ({ default: () => null }));
vi.mock("../pages/IssuesPage", () => ({ default: () => null }));
vi.mock("../pages/ActivityPage", () => ({ default: () => null }));
vi.mock("../pages/DigestPage", () => ({ default: () => null }));
vi.mock("../pages/UnitDashboardPage", () => ({ default: () => null }));
vi.mock("../pages/ReleasesPage", () => ({ default: () => null }));
vi.mock("../pages/DiscussionsPage", () => ({ default: () => null }));
vi.mock("../pages/ProjectsPage", () => ({ default: () => null }));
vi.mock("../pages/CodeSearchPage", () => ({ default: () => null }));
vi.mock("../pages/SettingsPage", () => ({ default: () => null }));
vi.mock("../pages/PullDetailPage", () => ({ default: () => null }));
vi.mock("../pages/IssueDetailPage", () => ({ default: () => null }));
vi.mock("../pages/CiStatusPage", () => ({ default: () => null }));
vi.mock("../pages/NotFoundPage", () => ({ default: () => null }));

describe("AppRouter", () => {
  beforeEach(() => {
    createBrowserRouterMock.mockClear();
  });

  it("creates the browser router only once across parent re-renders", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [tick, setTick] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            bump {tick}
          </button>
          <AppRouter onSignOut={() => undefined} />
        </div>
      );
    }

    render(<Harness />);
    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);
    const firstId = screen.getByTestId("router-provider").getAttribute("data-router-id");

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));

    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("router-provider").getAttribute("data-router-id")).toBe(firstId);
  });
});
