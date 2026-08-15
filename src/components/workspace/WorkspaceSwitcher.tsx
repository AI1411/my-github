import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useDataStore } from "../../stores/dataStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUiStore } from "../../stores/uiStore";
import { Avatar } from "../common/Avatar";
import { useAccountAttentionSummaries } from "../../hooks/useAccountAttentionSummaries";
import { useSettingsShortcut } from "../../hooks/useSettingsShortcut";
import { attentionTotal } from "../../lib/accountAttention";
import {
  accountIndexFromDigitKey,
  accountSwitchShortcutLabel,
  resolveAccountSwitchTarget,
} from "../../lib/accountSwitcherShortcut";
import { hostDisplayLabel } from "../../lib/githubHost";

interface WorkspaceSwitcherProps {
  onSignOut?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function WorkspaceSwitcher({ onSignOut }: WorkspaceSwitcherProps) {
  const isOpen = useUiStore((s) => s.workspaceSwitcherOpen);
  const open = useUiStore((s) => s.openWorkspaceSwitcher);
  const close = useUiStore((s) => s.closeWorkspaceSwitcher);
  const closeCommandPalette = useUiStore((s) => s.closeCommandPalette);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const reset = useAuthStore((s) => s.reset);
  const resetData = useDataStore((s) => s.reset);
  const pulls = useDataStore((s) => s.pulls);
  const issues = useDataStore((s) => s.issues);
  const notifications = useDataStore((s) => s.notifications);
  const accountHosts = useSettingsStore((s) => s.accountHosts);
  // Keep summaries warm so ⌘1–4 works globally, not only while the switcher is open.
  const { summaries } = useAccountAttentionSummaries(true);
  const navigate = useNavigate();

  const accounts =
    summaries.length > 0
      ? summaries
      : user
        ? [
            {
              login: user.login,
              avatarUrl: user.avatar_url,
              isActive: true,
              reviewRequests: 0,
              ciFailures: 0,
              mentions: 0,
            },
          ]
        : [];

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === user?.login) {
      close();
      return;
    }
    const nextUser = await invoke<{ login: string; avatar_url: string }>("cmd_switch_account", {
      accountId,
    });
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

  const handleAddAccount = () => {
    close();
    navigate("/settings");
  };

  const switchRef = useRef(handleSwitchAccount);
  switchRef.current = handleSwitchAccount;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useSettingsShortcut("workspaceSwitcher", () => {
    if (isOpen) {
      close();
      return;
    }
    closeCommandPalette();
    open();
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      const index = accountIndexFromDigitKey(event.key);
      if (index === null) return;
      const target = resolveAccountSwitchTarget(accountsRef.current, index);
      if (!target) return;
      event.preventDefault();
      void switchRef.current(target.login);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!isOpen) return null;

  const recentWorkspaces = Array.from(
    new Set([
      ...pulls.map((p) => p.repo),
      ...issues.map((i) => i.repo),
      ...notifications.map((n) => n.repo),
    ]),
  ).slice(0, 6);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-start"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div
        className="m-3 w-64 rounded-xl shadow-xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Accounts
          </p>
        </div>
        {accounts.map((acct, index) => {
          const total = attentionTotal(acct);
          const isActive = acct.login === user?.login || acct.isActive;
          const shortcut = accountSwitchShortcutLabel(index);
          const hostLabel = hostDisplayLabel(accountHosts[acct.login]);
          return (
            <button
              key={acct.login}
              type="button"
              onClick={() => void handleSwitchAccount(acct.login)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left"
              style={{
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Avatar login={acct.login} src={acct.avatarUrl ?? undefined} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {acct.login}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--text-muted)" }}
                  data-testid={`account-host-${acct.login}`}
                >
                  {hostLabel}
                </p>
                <p
                  className="text-xs"
                  style={{ color: isActive ? "var(--accent-green)" : "var(--text-muted)" }}
                >
                  {isActive ? "Active" : "Switch"}
                </p>
              </div>
              {total > 0 && (
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full tabular-nums"
                  style={{
                    backgroundColor: "var(--bg-overlay)",
                    color: "var(--text-secondary)",
                  }}
                  title={`Review ${acct.reviewRequests} · CI ${acct.ciFailures} · Mentions ${acct.mentions}`}
                  aria-label={`${total} attention items`}
                >
                  {total}
                </span>
              )}
              {shortcut && (
                <kbd
                  className="text-[10px] px-1 py-0.5 rounded font-mono"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-muted)",
                  }}
                >
                  {shortcut}
                </kbd>
              )}
            </button>
          );
        })}
        <div className="px-2 py-1.5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <button
            type="button"
            onClick={handleAddAccount}
            className="w-full text-left text-sm px-3 py-2 rounded-md"
            style={{
              color: "var(--accent-blue, #58a6ff)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Add another account
          </button>
        </div>
        <div className="px-4 py-2.5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
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
        <div className="border-t p-2" style={{ borderColor: "var(--border-subtle)" }}>
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
