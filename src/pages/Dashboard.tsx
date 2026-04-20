interface AuthUser {
  login: string;
  avatar_url: string;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-3 overflow-hidden"
          style={{ border: "2px solid var(--border-default)" }}
        >
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {user.login}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Dashboard — coming in M3
        </p>
      </div>
      <button
        onClick={onLogout}
        className="text-xs px-3 py-1.5 rounded-md"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-default)",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
