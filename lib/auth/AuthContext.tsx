"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { TokenStorage } from "../apiClient";
import { AuthService, type User } from "../services/authService";

/* ─── Context shape ─── */

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    async function rehydrate() {
      const access = TokenStorage.getAccessToken();
      if (!access) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await AuthService.getMe(access);
        setUser(me);
        TokenStorage.saveUser(me as unknown as Record<string, unknown>);
      } catch {
        // Token may be expired — try refresh
        const refresh = TokenStorage.getRefreshToken();
        if (refresh) {
          try {
            const data = await AuthService.refreshToken(refresh);
            TokenStorage.saveTokens(data.access, data.refresh || refresh);
            const me = await AuthService.getMe(data.access);
            setUser(me);
            TokenStorage.saveUser(me as unknown as Record<string, unknown>);
          } catch {
            TokenStorage.clearAll();
          }
        } else {
          TokenStorage.clearAll();
        }
      } finally {
        setIsLoading(false);
      }
    }

    rehydrate();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await AuthService.login(email, password);
    TokenStorage.saveTokens(data.access, data.refresh);
    TokenStorage.saveUser(data.user as unknown as Record<string, unknown>);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    TokenStorage.clearAll();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
