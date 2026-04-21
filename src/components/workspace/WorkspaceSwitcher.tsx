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
  const reset = useAuthStore((s) => s.reset);
  const resetData = useDataStore((s) => s.reset);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    await invoke("cmd_logout");
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
        className="m-3 w-52 rounded-xl shadow-xl overflow-hidden"
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
          <div className="px-4 py-3 flex items-center gap-2">
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
          </div>
        )}
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
