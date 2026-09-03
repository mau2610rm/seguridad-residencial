import React, { createContext, useContext, useEffect, useState } from "react";
import { getAccessToken, clearTokens, setTokens } from "../services/api";
import api from "../services/api";

export type Role = "admin_residencial" | "guardia" | "residente";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role: Role;
  residencialId: string;
  unitId: string | null;
  residencial: { id: string; nombre: string } | null;
  unit: { id: string; number: string } | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      await clearTokens();
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        await clearTokens();
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const loginWithGoogle = async (idToken: string) => {
    const { data } = await api.post("/auth/google", { idToken });
    await setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
