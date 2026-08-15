import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppearanceEffect } from "./hooks/useAppearanceEffect";
import { useWindowTitle } from "./hooks/useWindowTitle";
import { useAuthStore, type AuthUser } from "./stores/authStore";
import { isAuthExpiredError } from "./lib/authErrors";
import { useDataStore } from "./stores/dataStore";
import LoginPage from "./pages/LoginPage";
import { AppRouter } from "./lib/router";

function App() {
  useAppearanceEffect();
  useWindowTitle();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const reset = useAuthStore((s) => s.reset);
  const resetData = useDataStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    invoke<AuthUser | null>("cmd_get_current_user")
      .then((u) => {
        if (cancelled) return;
        if (u) setUser(u);
        else setStatus("unauthenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isAuthExpiredError(error)) useAuthStore.getState().setExpired();
        else setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, [setUser, setStatus]);

  const handleLoginSuccess = (u: AuthUser) => {
    setUser(u);
  };

  const handleLogout = () => {
    resetData();
    reset();
  };

  if (status === "checking") {
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

  if (status === "authenticated" && user) {
    return <AppRouter onSignOut={handleLogout} />;
  }

  return <LoginPage expired={status === "expired"} onSuccess={handleLoginSuccess} />;
}

export default App;
