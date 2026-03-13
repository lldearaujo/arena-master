import { create } from "zustand";

export type Role = "superadmin" | "admin" | "aluno";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

type UserInfo = {
  id: number;
  role: Role;
  dojoId: number | null;
  email: string;
  avatarUrl?: string | null;
};

type AuthState = {
  tokens: Tokens | null;
  user: UserInfo | null;
  setSession: (tokens: Tokens, user: UserInfo) => void;
  updateUser: (updates: Partial<UserInfo>) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  tokens: null,
  user: null,
  setSession: (tokens, user) => set({ tokens, user }),
  updateUser: (updates) =>
    set((s) => (s.user ? { user: { ...s.user, ...updates } } : {})),
  clearSession: () => set({ tokens: null, user: null }),
}));

