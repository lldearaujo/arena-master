import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
};

type AuthState = {
  tokens: Tokens | null;
  user: UserInfo | null;
  setSession: (tokens: Tokens, user: UserInfo) => void;
  clearSession: () => void;
};

const STORAGE_KEY = "arena-master-auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tokens: null,
      user: null,
      setSession: (tokens, user) => set({ tokens, user }),
      clearSession: () => set({ tokens: null, user: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
      }),
    }
  )
);
