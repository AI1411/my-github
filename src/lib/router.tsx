import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import InboxPage from "../pages/InboxPage";
import ReviewQueuePage from "../pages/ReviewQueuePage";
import MyBlockersPage from "../pages/MyBlockersPage";
import PullsPage from "../pages/PullsPage";
import IssuesPage from "../pages/IssuesPage";
import ActivityPage from "../pages/ActivityPage";
import DigestPage from "../pages/DigestPage";
import UnitDashboardPage from "../pages/UnitDashboardPage";
import SettingsPage from "../pages/SettingsPage";
import PullDetailPage from "../pages/PullDetailPage";
import IssueDetailPage from "../pages/IssueDetailPage";
import CiStatusPage from "../pages/CiStatusPage";
import NotFoundPage from "../pages/NotFoundPage";

interface ShellLayoutProps {
  onSignOut: () => void;
}

function ShellLayout({ onSignOut }: ShellLayoutProps) {
  return (
    <AppShell
      sidebar={<Sidebar onSignOut={onSignOut} />}
      main={
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      }
    />
  );
}

export function createAppRouter(onSignOut: () => void) {
  return createBrowserRouter([
    {
      path: "/",
      element: <ShellLayout onSignOut={onSignOut} />,
      children: [
        { index: true, element: <Navigate to="/inbox" replace /> },
        { path: "inbox", element: <InboxPage /> },
        { path: "review-queue", element: <ReviewQueuePage /> },
        { path: "my-blockers", element: <MyBlockersPage /> },
        { path: "pulls", element: <PullsPage /> },
        { path: "pulls/:owner/:repo/:number", element: <PullDetailPage /> },
        { path: "issues", element: <IssuesPage /> },
        { path: "issues/:owner/:repo/:number", element: <IssueDetailPage /> },
        { path: "activity", element: <ActivityPage /> },
        { path: "digest", element: <DigestPage /> },
        { path: "dashboards", element: <UnitDashboardPage /> },
        { path: "ci", element: <CiStatusPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ]);
}

export interface AppRouterProps {
  onSignOut: () => void;
}

export function AppRouter({ onSignOut }: AppRouterProps) {
  const router = createAppRouter(onSignOut);
  return <RouterProvider router={router} />;
}
