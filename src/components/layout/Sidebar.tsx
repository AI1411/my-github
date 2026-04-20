import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { Avatar } from "../common/Avatar";

interface NavItem {
  to: string;
  label: string;
  count?: number;
}

interface SidebarProps {
  onSignOut?: () => void;
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const notifications = useDataStore((s) => s.notifications);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const navItems: NavItem[] = [
    { to: "/inbox", label: "Inbox", count: unreadCount || undefined },
    { to: "/pulls", label: "Pull Requests", count: pulls.length || undefined },
    { to: "/issues", label: "Issues", count: issues.length || undefined },
    { to: "/activity", label: "Activity" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-4 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <p
          className="text-[11px] uppercase tracking-wider font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          Workspace
        </p>
        <p
          className="text-sm font-semibold mt-1 truncate"
          style={{ color: "var(--text-primary)" }}
        >
          Pulse
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Primary">
        <ul className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className="flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors"
                style={({ isActive }) => ({
                  backgroundColor: isActive
                    ? "var(--bg-tertiary)"
                    : "transparent",
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                })}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "var(--bg-overlay)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div
        className="px-3 py-3 border-t flex items-center gap-2"
        style={{ borderColor: "var(--border-default)" }}
      >
        {user && (
          <>
            <Avatar login={user.login} src={user.avatar_url} size="sm" />
            <span
              className="text-xs flex-1 truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {user.login}
            </span>
          </>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="text-[11px] px-2 py-1 rounded-md"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
