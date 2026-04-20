import { useState } from "react";
import { DeviceFlowTab } from "./components/DeviceFlowTab";

type Tab = "oauth" | "pat";

interface AuthUser {
  login: string;
  avatar_url: string;
}

interface LoginPageProps {
  onSuccess?: (user: AuthUser) => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("oauth");

  const handleAuthSuccess = (user: AuthUser) => {
    onSuccess?.(user);
  };

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
            Pulse
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            GitHub cross-repository dashboard
          </p>
        </div>

        <div
          className="flex gap-0 mb-6 border-b"
          style={{ borderColor: "var(--border-default)" }}
          role="tablist"
        >
          <button
            role="tab"
            aria-selected={activeTab === "oauth"}
            onClick={() => setActiveTab("oauth")}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color:
                activeTab === "oauth"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                activeTab === "oauth"
                  ? "2px solid var(--accent-blue)"
                  : "2px solid transparent",
            }}
          >
            Device Flow
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "pat"}
            onClick={() => setActiveTab("pat")}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color:
                activeTab === "pat"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                activeTab === "pat"
                  ? "2px solid var(--accent-blue)"
                  : "2px solid transparent",
            }}
          >
            Personal Token
          </button>
        </div>

        <div className="mt-6">
          {activeTab === "oauth" && (
            <div data-testid="device-flow-tab">
              <DeviceFlowTab onSuccess={handleAuthSuccess} />
            </div>
          )}
          {activeTab === "pat" && (
            <div data-testid="pat-tab">
              <p
                className="text-sm text-center"
                style={{ color: "var(--text-secondary)" }}
              >
                Personal Access Token — coming in M2-017
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
