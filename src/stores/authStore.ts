import { create } from "zustand";

export interface AuthUser {
  login: string;
  avatar_url: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: "checking" | "unauthenticated" | "authenticated";
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: "checking",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setToken: (token) => set({ token }),
  setStatus: (status) => set({ status }),
  reset: () => set({ user: null, token: null, status: "unauthenticated" }),
}));
