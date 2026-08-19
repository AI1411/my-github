import { create } from "zustand";
import { isAuthExpiredError } from "../lib/authErrors";

export interface AuthUser {
  login: string;
  avatar_url: string;
}

export interface AuthState {
  user: AuthUser | null;
  status: "checking" | "unauthenticated" | "authenticated" | "expired";
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  setExpired: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "checking",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setStatus: (status) => set({ status }),
  setExpired: () => set({ user: null, status: "expired" }),
  reset: () => set({ user: null, status: "unauthenticated" }),
}));

export function reportAuthFailure(error: unknown): boolean {
  if (!isAuthExpiredError(error)) return false;
  useAuthStore.getState().setExpired();
  return true;
}
