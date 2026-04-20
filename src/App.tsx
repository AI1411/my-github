import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

type Screen = "checking" | "login" | "dashboard";

interface AuthUser {
  login: string;
  avatar_url: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    invoke<AuthUser | null>("cmd_get_current_user")
      .then(u => {
        if (u) {
          setUser(u);
          setScreen("dashboard");
        } else {
          setScreen("login");
        }
      })
      .catch(() => setScreen("login"));
  }, []);

  const handleLoginSuccess = (u: AuthUser) => {
    setUser(u);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    setScreen("login");
  };

  if (screen === "checking") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <span
          className="inline-block w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--accent-blue)" }}
        />
      </div>
    );
  }

  if (screen === "dashboard" && user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  return <LoginPage onSuccess={handleLoginSuccess} />;
}

export default App;
