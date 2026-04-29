import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { useUiStore } from "../../stores/uiStore";
import { Avatar } from "../common/Avatar";

interface WorkspaceSwitcherProps {
  onSignOut?: () => void;
}

export function WorkspaceSwitcher({ onSignOut }: WorkspaceSwitcherProps) {
  const isOpen = useUiStore((s) => s.workspaceSwitcherOpen);
  const close = useUiStore((s) => s.closeWorkspaceSwitcher);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const reset = useAuthStore((s) => s.reset);
  const resetData = useDataStore((s) => s.reset);
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const notifications = useDataStore((s) => s.notifications);

  if (!isOpen) return null;

  const recentWorkspaces = Array.from(
    new Set([
      ...pulls.map((p) => p.repo),
      ...issues.map((i) => i.repo),
      ...notifications.map((n) => n.repo),
    ]),
  ).slice(0, 6);

  const handleSwitchAccount = async (accountId: string) => {
    const nextUser = await invoke<{ login: string; avatar_url: string }>(
      "cmd_switch_account",
      { accountId },
    );
    resetData();
    setUser(nextUser);
    await invoke("cmd_sync_now");
    close();
  };

  const handleSignOut = async () => {
    if (user) await invoke("cmd_logout", { accountId: user.login });
    resetData();
    reset();
    close();
    onSignOut?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-start"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={close}
    >
      <div
        className="m-3 w-64 rounded-xl shadow-xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-2.5 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Accounts
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => void handleSwitchAccount(user.login)}
            className="w-full px-4 py-3 flex items-center gap-2 text-left"
            style={{
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Avatar login={user.login} src={user.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {user.login}
              </p>
              <p className="text-xs" style={{ color: "var(--accent-green)" }}>
                Active
              </p>
            </div>
          </button>
        )}
        <div
          className="px-4 py-2.5 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Recent workspaces
          </p>
          {recentWorkspaces.length === 0 ? (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              No recent repositories
            </p>
          ) : (
            <div className="mt-1">
              {recentWorkspaces.map((repo) => (
                <p
                  key={repo}
                  className="text-sm truncate py-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {repo}
                </p>
              ))}
            </div>
          )}
        </div>
        <div
          className="border-t p-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={() => void handleSignOut()}
            className="w-full text-left text-sm px-3 py-2 rounded-md"
            style={{
              color: "var(--accent-red)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
