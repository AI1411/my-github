import { create } from "zustand";
import { isAuthExpiredError } from "../lib/authErrors";

export interface AuthUser {
  login: string;
  avatar_url: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: "checking" | "unauthenticated" | "authenticated" | "expired";
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  setExpired: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: "checking",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setToken: (token) => set({ token }),
  setStatus: (status) => set({ status }),
  setExpired: () => set({ user: null, token: null, status: "expired" }),
  reset: () => set({ user: null, token: null, status: "unauthenticated" }),
}));

/** Sets auth to expired on 401 / Bad credentials. Network errors are ignored. */
export function reportAuthFailure(error: unknown): boolean {
  if (!isAuthExpiredError(error)) return false;
  useAuthStore.getState().setExpired();
  return true;
}
