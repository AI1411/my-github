import { PATTab } from "./components/PATTab";

interface AuthUser {
  login: string;
  avatar_url: string;
}

interface LoginPageProps {
  onSuccess?: (user: AuthUser) => void;
  expired?: boolean;
}

export default function LoginPage({ onSuccess, expired = false }: LoginPageProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-md px-6">
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            my-github
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            GitHub cross-repository dashboard
          </p>
          {expired && (
            <p className="mt-3 text-sm" style={{ color: "var(--accent-orange, #d29922)" }}>
              Token expired. Paste a new PAT.
            </p>
          )}
        </div>

        <div className="mt-6" data-testid="pat-tab">
          <PATTab onSuccess={(user) => onSuccess?.(user)} />
        </div>
      </div>
    </div>
  );
}
